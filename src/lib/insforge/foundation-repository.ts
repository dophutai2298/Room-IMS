import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import type { FoundationRepository } from "@/lib/foundation/repository";
import type {
  ContractRecord,
  InvoiceRecord,
  MvpSeededData,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
  UtilityPricingRecord,
} from "./types";
import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";

type QueryResponse<T> = {
  data: T | null;
  error: unknown;
};

type InsForgeServerClient = Awaited<ReturnType<typeof createInsForgeServerClient>>;

export function createInsForgeFoundationRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): FoundationRepository {
  let clientPromise: Promise<InsForgeServerClient> | null = null;
  const getClient = () => {
    clientPromise ??= createInsForgeServerClient();
    return clientPromise;
  };

  return {
    async readSeededData() {
      const query = () => readSeededDataFromInsForge(getClient);

      return timer
        ? timer.measure("repository.insforge.seeded-data-read", query)
        : query();
    },
    async touchRoom(roomId) {
      const query = () => touchRoomInInsForge({ getClient, roomId });

      return timer
        ? timer.measure("repository.insforge.room-touch", query)
        : query();
    },
  };
}

async function readSeededDataFromInsForge(
  getClient: () => Promise<InsForgeServerClient>,
): Promise<AppResult<MvpSeededData>> {
  try {
    const client = await getClient();
    const [rooms, tenants, contracts, utilityMetrics, utilityPricing, invoices] =
      await Promise.all([
        client.database.from("rooms").select("*").order("name"),
        client.database.from("tenants").select("*").order("full_name"),
        client.database.from("contracts").select("*").order("start_date"),
        client.database
          .from("utility_metrics")
          .select("*")
          .order("year")
          .order("month"),
        client.database
          .from("utility_pricing")
          .select("*")
          .eq("is_active", true)
          .order("effective_from"),
        client.database.from("invoices").select("*").order("year").order("month"),
      ]);

    for (const response of [
      rooms,
      tenants,
      contracts,
      utilityMetrics,
      utilityPricing,
      invoices,
    ]) {
      if (response.error) {
        return fail(response.error);
      }
    }

    return ok({
      rooms: (rooms.data ?? []) as RoomRecord[],
      tenants: (tenants.data ?? []) as TenantRecord[],
      contracts: (contracts.data ?? []) as ContractRecord[],
      utilityMetrics: (utilityMetrics.data ?? []) as UtilityMetricRecord[],
      utilityPricing: (utilityPricing.data ?? []) as UtilityPricingRecord[],
      invoices: (invoices.data ?? []) as InvoiceRecord[],
    });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function touchRoomInInsForge({
  getClient,
  roomId,
}: {
  getClient: () => Promise<InsForgeServerClient>;
  roomId: string;
}): Promise<AppResult<RoomRecord>> {
  try {
    const client = await getClient();
    const response = (await client.database
      .from("rooms")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", roomId)
      .select()
      .limit(1)) as QueryResponse<RoomRecord[]>;

    if (response.error) {
      return fail(response.error, "Could not write room update");
    }

    const room = response.data?.[0];

    return room
      ? ok(room)
      : appError({
          message: "Room was not found.",
          code: "ROOM_NOT_FOUND",
          statusCode: 404,
        });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}
