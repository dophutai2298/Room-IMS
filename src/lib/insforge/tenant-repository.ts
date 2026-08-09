import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { buildTenantList, type TenantListItem } from "@/lib/tenants/presenter";
import type {
  TenantRepository,
  UpdateTenantInput,
  WriteTenantInput,
} from "@/lib/tenants/repository";
import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import type { ContractRecord, RoomRecord, TenantRecord } from "./types";

type QueryResponse<T> = {
  data: T | null;
  error: unknown;
};

type InsForgeServerClient = Awaited<ReturnType<typeof createInsForgeServerClient>>;

export function createInsForgeTenantRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): TenantRepository {
  let clientPromise: Promise<InsForgeServerClient> | null = null;
  const getClient = () => {
    clientPromise ??= createInsForgeServerClient();
    return clientPromise;
  };

  return {
    async listRoomTenants(roomId) {
      const query = () => readRoomTenantsFromInsForge({ roomId, getClient });

      return timer
        ? timer.measure("repository.insforge.tenants-list", query)
        : query();
    },
    async createTenant(input) {
      const query = () => createTenantInInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.tenant-create", query)
        : query();
    },
    async readTenant(tenantId) {
      const query = () => readTenantFromInsForge({ tenantId, getClient });

      return timer
        ? timer.measure("repository.insforge.tenant-detail", query)
        : query();
    },
    async updateTenant(input) {
      const query = () => updateTenantInInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.tenant-update", query)
        : query();
    },
  };
}

async function readTenantFromInsForge({
  tenantId,
  getClient,
}: {
  tenantId: string;
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<TenantListItem>> {
  try {
    const client = await getClient();
    const response = (await client.database
      .from("tenants")
      .select(tenantSelect)
      .eq("id", tenantId)
      .limit(1)) as QueryResponse<TenantRecord[]>;

    if (response.error) {
      return fail(response.error, "Could not read Tenant");
    }

    const tenant = response.data?.[0];

    if (!tenant) {
      return appError({
        message: "Tenant was not found.",
        code: "TENANT_NOT_FOUND",
        statusCode: 404,
      });
    }

    return buildSingleTenantItem({ client, tenant });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readRoomTenantsFromInsForge({
  roomId,
  getClient,
}: {
  roomId: string;
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<TenantListItem[]>> {
  try {
    const client = await getClient();
    const roomResult = await readRoomById({ client, roomId });

    if (roomResult.error) {
      return roomResult;
    }

    const [tenants, activeContract] = await Promise.all([
      readTenantRowsForRoom({ client, roomId }),
      readActiveContractForRoom({ client, roomId }),
    ]);

    if (tenants.error) {
      return tenants;
    }

    if (activeContract.error) {
      return activeContract;
    }

    return ok(
      buildTenantList({
        tenants: tenants.data,
        activeContract: activeContract.data,
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function createTenantInInsForge({
  roomId,
  name,
  phone,
  status,
  getClient,
}: WriteTenantInput & {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<TenantListItem>> {
  try {
    const client = await getClient();
    const roomResult = await readRoomById({ client, roomId });

    if (roomResult.error) {
      return roomResult;
    }

    const response = (await client.database
      .from("tenants")
      .insert({
        room_id: roomId,
        full_name: name,
        phone,
        status,
        is_key_tenant: false,
      })
      .select(tenantSelect)
      .limit(1)) as QueryResponse<TenantRecord[]>;

    if (response.error) {
      return fail(response.error, "Could not create Tenant");
    }

    const tenant = response.data?.[0];

    if (!tenant) {
      return fail(new Error("Tenant create returned no rows"), "Could not create Tenant");
    }

    return buildSingleTenantItem({ client, tenant });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function updateTenantInInsForge({
  tenantId,
  name,
  phone,
  status,
  getClient,
}: UpdateTenantInput & {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<TenantListItem>> {
  try {
    const client = await getClient();
    const currentResponse = (await client.database
      .from("tenants")
      .select(tenantSelect)
      .eq("id", tenantId)
      .limit(1)) as QueryResponse<TenantRecord[]>;

    if (currentResponse.error) {
      return fail(currentResponse.error, "Could not read Tenant");
    }

    const currentTenant = currentResponse.data?.[0];

    if (!currentTenant) {
      return appError({
        message: "Tenant was not found.",
        code: "TENANT_NOT_FOUND",
        statusCode: 404,
      });
    }

    const response = (await client.database
      .from("tenants")
      .update({
        full_name: name,
        phone,
        status,
      })
      .eq("id", tenantId)
      .select(tenantSelect)
      .limit(1)) as QueryResponse<TenantRecord[]>;

    if (response.error) {
      return fail(response.error, "Could not update Tenant");
    }

    const tenant = response.data?.[0];

    if (!tenant) {
      return fail(new Error("Tenant update returned no rows"), "Could not update Tenant");
    }

    return buildSingleTenantItem({ client, tenant });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function buildSingleTenantItem({
  client,
  tenant,
}: {
  client: InsForgeServerClient;
  tenant: TenantRecord;
}): Promise<AppResult<TenantListItem>> {
  const activeContract = await readActiveContractForRoom({
    client,
    roomId: tenant.room_id ?? "",
  });

  if (activeContract.error) {
    return activeContract;
  }

  const item = buildTenantList({
    tenants: [tenant],
    activeContract: activeContract.data,
  })[0];

  if (!item) {
    return fail(new Error("Tenant presenter returned no item"), "Could not read Tenant");
  }

  return ok(item);
}

async function readRoomById({
  client,
  roomId,
}: {
  client: InsForgeServerClient;
  roomId: string;
}): Promise<AppResult<Pick<RoomRecord, "id">>> {
  const response = (await client.database
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .limit(1)) as QueryResponse<Array<Pick<RoomRecord, "id">>>;

  if (response.error) {
    return fail(response.error, "Could not read Room");
  }

  const room = response.data?.[0];

  if (!room) {
    return appError({
      message: "Room was not found.",
      code: "ROOM_NOT_FOUND",
      statusCode: 404,
    });
  }

  return ok(room);
}

async function readTenantRowsForRoom({
  client,
  roomId,
}: {
  client: InsForgeServerClient;
  roomId: string;
}): Promise<AppResult<TenantRecord[]>> {
  const response = (await client.database
    .from("tenants")
    .select(tenantSelect)
    .eq("room_id", roomId)
    .order("full_name")) as QueryResponse<TenantRecord[]>;

  if (response.error) {
    return fail(response.error, "Could not read Tenants");
  }

  return ok((response.data ?? []) as unknown as TenantRecord[]);
}

async function readActiveContractForRoom({
  client,
  roomId,
}: {
  client: InsForgeServerClient;
  roomId: string;
}): Promise<AppResult<ContractRecord | null>> {
  const response = (await client.database
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
    .order("start_date")) as QueryResponse<ContractRecord[]>;

  if (response.error) {
    return fail(response.error, "Could not read active Contract");
  }

  return ok(((response.data ?? []) as unknown as ContractRecord[])[0] ?? null);
}

const tenantSelect = [
  "id",
  "room_id",
  "full_name",
  "phone",
  "is_key_tenant",
  "status",
].join(", ");
