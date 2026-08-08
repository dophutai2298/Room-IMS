import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import {
  buildRoomListItem,
  buildRoomDetailView,
  buildRoomOperationsSummary,
} from "@/lib/rooms/presenter";
import type { RoomRepository } from "@/lib/rooms/repository";
import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import type {
  ContractRecord,
  InvoiceRecord,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
} from "./types";

type QueryResponse<T> = {
  data: T | null;
  error: unknown;
};

type InsForgeServerClient = Awaited<ReturnType<typeof createInsForgeServerClient>>;

export function createInsForgeRoomRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): RoomRepository {
  let clientPromise: Promise<InsForgeServerClient> | null = null;
  const getClient = () => {
    clientPromise ??= createInsForgeServerClient();
    return clientPromise;
  };

  return {
    async listRoomItems() {
      const query = () => readRoomItemsFromInsForge({ getClient });

      return timer
        ? timer.measure("repository.insforge.rooms-list", query)
        : query();
    },
    async createRoom(input) {
      const query = () => createRoomInInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.room-create", query)
        : query();
    },
    async updateRoom(input) {
      const query = () => updateRoomInInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.room-update", query)
        : query();
    },
    async readRoomDetail(roomId) {
      const query = () => readRoomDetailFromInsForge({ roomId, getClient });

      return timer
        ? timer.measure("repository.insforge.room-detail", query)
        : query();
    },
    async readRoomOperationsSummary(roomId) {
      const query = () =>
        readRoomOperationsSummaryFromInsForge({ roomId, getClient });

      return timer
        ? timer.measure("repository.insforge.room-operations-summary", query)
        : query();
    },
  };
}

export async function readRoomItemsFromInsForge({
  getClient = createInsForgeServerClient,
}: {
  getClient?: () => Promise<InsForgeServerClient>;
} = {}) {
  try {
    const client = await getClient();
    const relatedData = await readRoomRelatedData(client);

    if (relatedData.error) {
      return relatedData;
    }

    const { rooms, tenants, activeContracts } = relatedData.data;

    return ok(
      rooms
        .map((room) =>
          buildRoomListItem({
            room,
            tenants: tenants.filter((tenant) => tenant.room_id === room.id),
            activeContract:
              activeContracts.find((contract) => contract.room_id === room.id) ??
              null,
          }),
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function createRoomInInsForge({
  name,
  basePrice,
  status,
  getClient,
}: {
  name: string;
  basePrice: number;
  status: RoomRecord["status"];
  getClient: () => Promise<InsForgeServerClient>;
}) {
  try {
    const client = await getClient();
    const response = (await client.database
      .from("rooms")
      .insert({
        name,
        status,
        base_price: basePrice,
        updated_at: new Date().toISOString(),
      })
      .select(roomSelect)
      .limit(1)) as QueryResponse<RoomRecord[]>;

    if (response.error) {
      return fail(response.error, "Could not create Room");
    }

    const room = response.data?.[0];

    if (!room) {
      return fail(new Error("Room create returned no rows"), "Could not create Room");
    }

    return ok(
      buildRoomListItem({
        room,
        tenants: [],
        activeContract: null,
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function updateRoomInInsForge({
  roomId,
  name,
  basePrice,
  status,
  getClient,
}: {
  roomId: string;
  name: string;
  basePrice: number;
  status: RoomRecord["status"];
  getClient: () => Promise<InsForgeServerClient>;
}) {
  try {
    const client = await getClient();
    const response = (await client.database
      .from("rooms")
      .update({
        name,
        status,
        base_price: basePrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId)
      .select(roomSelect)) as QueryResponse<RoomRecord[]>;

    if (response.error) {
      return fail(response.error, "Could not update Room");
    }

    const room = response.data?.[0];

    if (!room) {
      return appError({
        message: "Room was not found.",
        code: "ROOM_NOT_FOUND",
        statusCode: 404,
      });
    }

    const item = await readRoomItemFromInsForge({ room, client });

    if (item.error) {
      return item;
    }

    return ok(item.data);
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readRoomDetailFromInsForge({
  roomId,
  getClient,
}: {
  roomId: string;
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<ReturnType<typeof buildRoomDetailView>>> {
  try {
    const client = await getClient();
    const [rooms, tenants, activeContracts] = await Promise.all([
      client.database
        .from("rooms")
        .select("id, name, status, base_price")
        .eq("id", roomId)
        .limit(1),
      client.database
        .from("tenants")
        .select("id, room_id, full_name, phone, is_key_tenant, status")
        .eq("room_id", roomId)
        .order("full_name"),
      client.database
        .from("contracts")
        .select(
          [
            "id",
            "room_id",
            "key_tenant_id",
            "deposit_amount",
            "start_date",
            "end_date",
            "status",
            "rent_amount",
            "electricity_price_override",
            "water_price_override",
          ].join(", "),
        )
        .eq("room_id", roomId)
        .eq("status", "Active")
        .order("start_date"),
    ]);

    for (const response of [rooms, tenants, activeContracts]) {
      if (response.error) {
        return fail(response.error);
      }
    }

    const room = ((rooms.data ?? []) as unknown as RoomRecord[])[0];

    if (!room) {
      return appError({
        message: "Room was not found.",
        code: "ROOM_NOT_FOUND",
        statusCode: 404,
      });
    }

    return ok(
      buildRoomDetailView({
        room,
        tenants: (tenants.data ?? []) as unknown as TenantRecord[],
        activeContract:
          ((activeContracts.data ?? []) as unknown as ContractRecord[])[0] ??
          null,
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readRoomOperationsSummaryFromInsForge({
  roomId,
  getClient,
}: {
  roomId: string;
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<ReturnType<typeof buildRoomOperationsSummary>>> {
  try {
    const client = await getClient();
    const [rooms, metrics, invoices] = await Promise.all([
      client.database.from("rooms").select("id").eq("id", roomId).limit(1),
      client.database
        .from("utility_metrics")
        .select(
          [
            "id",
            "room_id",
            "month",
            "year",
            "electricity_old",
            "electricity_new",
            "water_old",
            "water_new",
          ].join(", "),
        )
        .eq("room_id", roomId)
        .order("year")
        .order("month"),
      client.database
        .from("invoices")
        .select(
          [
            "id",
            "room_id",
            "month",
            "year",
            "room_fee",
            "electricity_fee",
            "water_fee",
            "other_fee",
            "other_fee_note",
            "total_amount",
            "amount_paid",
            "status",
          ].join(", "),
        )
        .eq("room_id", roomId)
        .order("year")
        .order("month"),
    ]);

    for (const response of [rooms, metrics, invoices]) {
      if (response.error) {
        return fail(response.error);
      }
    }

    const room = ((rooms.data ?? []) as unknown as Pick<RoomRecord, "id">[])[0];

    if (!room) {
      return appError({
        message: "Room was not found.",
        code: "ROOM_NOT_FOUND",
        statusCode: 404,
      });
    }

    return ok(
      buildRoomOperationsSummary({
        metrics: (metrics.data ?? []) as unknown as UtilityMetricRecord[],
        invoices: (invoices.data ?? []) as unknown as InvoiceRecord[],
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readRoomItemFromInsForge({
  room,
  client,
}: {
  room: RoomRecord;
  client: InsForgeServerClient;
}) {
  const [tenants, activeContracts] = await Promise.all([
    client.database
      .from("tenants")
      .select("id, room_id, full_name, phone, is_key_tenant, status")
      .eq("room_id", room.id)
      .order("full_name"),
    client.database
      .from("contracts")
      .select(
        [
          "id",
          "room_id",
          "key_tenant_id",
          "deposit_amount",
          "start_date",
          "end_date",
          "status",
          "rent_amount",
          "electricity_price_override",
          "water_price_override",
        ].join(", "),
      )
      .eq("room_id", room.id)
      .eq("status", "Active")
      .order("start_date"),
  ]);

  for (const response of [tenants, activeContracts]) {
    if (response.error) {
      return fail(response.error, "Could not read Room relationships");
    }
  }

  return ok(
    buildRoomListItem({
      room,
      tenants: (tenants.data ?? []) as unknown as TenantRecord[],
      activeContract:
        ((activeContracts.data ?? []) as unknown as ContractRecord[])[0] ?? null,
    }),
  );
}

async function readRoomRelatedData(
  client: InsForgeServerClient,
): Promise<
  AppResult<{
    rooms: RoomRecord[];
    tenants: TenantRecord[];
    activeContracts: ContractRecord[];
  }>
> {
  const [rooms, tenants, activeContracts] = await Promise.all([
    client.database.from("rooms").select(roomSelect).order("name"),
    client.database
      .from("tenants")
      .select("id, room_id, full_name, phone, is_key_tenant, status")
      .order("full_name"),
    client.database
      .from("contracts")
      .select(
        [
          "id",
          "room_id",
          "key_tenant_id",
          "deposit_amount",
          "start_date",
          "end_date",
          "status",
          "rent_amount",
          "electricity_price_override",
          "water_price_override",
        ].join(", "),
      )
      .eq("status", "Active")
      .order("start_date"),
  ]);

  for (const response of [rooms, tenants, activeContracts]) {
    if (response.error) {
      return fail(response.error, "Could not read Rooms");
    }
  }

  return ok({
    rooms: (rooms.data ?? []) as unknown as RoomRecord[],
    tenants: (tenants.data ?? []) as unknown as TenantRecord[],
    activeContracts: (activeContracts.data ?? []) as unknown as ContractRecord[],
  });
}

const roomSelect = "id, name, status, base_price, created_at, updated_at";
