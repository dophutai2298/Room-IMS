import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import type { FoundationRepository } from "@/lib/foundation/repository";
import { getActiveOwnerAppUserId } from "@/lib/server/operational-owner-scope";
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
    clientPromise ??= createInsForgeServerClient({ timer });
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
    const ownerAppUserId = getActiveOwnerAppUserId();
    const [rooms, tenants, contracts, utilityMetrics, utilityPricing, invoices] =
      await Promise.all([
        client.database
          .from("rooms")
          .select(roomSelect)
          .eq("owner_app_user_id", ownerAppUserId)
          .order("name"),
        client.database
          .from("tenants")
          .select(tenantSelect)
          .eq("owner_app_user_id", ownerAppUserId)
          .order("full_name"),
        client.database
          .from("contracts")
          .select(contractSelect)
          .eq("owner_app_user_id", ownerAppUserId)
          .order("start_date"),
        client.database
          .from("utility_metrics")
          .select(utilityMetricSelect)
          .eq("owner_app_user_id", ownerAppUserId)
          .order("year")
          .order("month"),
        client.database
          .from("utility_pricing")
          .select(utilityPricingSelect)
          .eq("owner_app_user_id", ownerAppUserId)
          .eq("is_active", true)
          .order("effective_from"),
        client.database
          .from("invoices")
          .select(invoiceSelect)
          .eq("owner_app_user_id", ownerAppUserId)
          .order("year")
          .order("month"),
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
      rooms: (rooms.data ?? []) as unknown as RoomRecord[],
      tenants: (tenants.data ?? []) as unknown as TenantRecord[],
      contracts: (contracts.data ?? []) as unknown as ContractRecord[],
      utilityMetrics: (utilityMetrics.data ?? []) as unknown as UtilityMetricRecord[],
      utilityPricing: (utilityPricing.data ?? []) as unknown as UtilityPricingRecord[],
      invoices: (invoices.data ?? []) as unknown as InvoiceRecord[],
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
    const ownerAppUserId = getActiveOwnerAppUserId();
    const response = (await client.database
      .from("rooms")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", roomId)
      .eq("owner_app_user_id", ownerAppUserId)
      .select(roomSelect)
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

const roomSelect = "id, name, floor, status, base_price, owner_app_user_id, created_at, updated_at";

const tenantSelect = [
  "id",
  "room_id",
  "full_name",
  "phone",
  "date_of_birth",
  "permanent_address",
  "cccd_number",
  "is_key_tenant",
  "cccd_front_url",
  "cccd_back_url",
  "status",
  "owner_app_user_id",
].join(", ");

const contractSelect = [
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
  "owner_app_user_id",
].join(", ");

const utilityMetricSelect = [
  "id",
  "room_id",
  "month",
  "year",
  "electricity_old",
  "electricity_new",
  "water_old",
  "water_new",
  "owner_app_user_id",
].join(", ");

const utilityPricingSelect = [
  "id",
  "effective_from",
  "electricity_unit_price",
  "water_unit_price",
  "is_active",
  "owner_app_user_id",
].join(", ");

const invoiceSelect = [
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
  "owner_app_user_id",
].join(", ");
