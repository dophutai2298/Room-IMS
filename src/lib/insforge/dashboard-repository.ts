import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import {
  buildDashboardMissingUtilityMetrics,
  buildDashboardRevenue,
  buildDashboardRoomAvailability,
  buildDashboardUnpaidInvoices,
} from "@/lib/dashboard/presenter";
import type { DashboardRepository } from "@/lib/dashboard/repository";
import type { BillingPeriod } from "@/lib/utilities/presenter";
import { fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import type {
  ContractRecord,
  InvoiceRecord,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
} from "./types";

type InsForgeServerClient = Awaited<ReturnType<typeof createInsForgeServerClient>>;

export function createInsForgeDashboardRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): DashboardRepository {
  let clientPromise: Promise<InsForgeServerClient> | null = null;
  const getClient = () => {
    clientPromise ??= createInsForgeServerClient();
    return clientPromise;
  };

  return {
    async readRevenueSummary(billingPeriod) {
      const query = () => readRevenueSummaryFromInsForge({ getClient, billingPeriod });

      return timer
        ? timer.measure("repository.insforge.dashboard-revenue", query)
        : query();
    },
    async readRoomAvailability() {
      const query = () => readRoomAvailabilityFromInsForge({ getClient });

      return timer
        ? timer.measure("repository.insforge.dashboard-room-availability", query)
        : query();
    },
    async readMissingUtilityMetrics(billingPeriod) {
      const query = () =>
        readMissingUtilityMetricsFromInsForge({ getClient, billingPeriod });

      return timer
        ? timer.measure("repository.insforge.dashboard-missing-utility-metrics", query)
        : query();
    },
    async readUnpaidInvoices(billingPeriod) {
      const query = () => readUnpaidInvoicesFromInsForge({ getClient, billingPeriod });

      return timer
        ? timer.measure("repository.insforge.dashboard-unpaid-invoices", query)
        : query();
    },
  };
}

async function readRevenueSummaryFromInsForge({
  getClient,
  billingPeriod,
}: {
  getClient: () => Promise<InsForgeServerClient>;
  billingPeriod: BillingPeriod;
}) {
  try {
    const client = await getClient();
    const response = await client.database
      .from("invoices")
      .select(invoiceSelect)
      .order("year")
      .order("month");

    if (response.error) {
      return fail(response.error, "Could not read Dashboard revenue");
    }

    return ok(
      buildDashboardRevenue({
        invoices: (response.data ?? []) as unknown as InvoiceRecord[],
        billingPeriod,
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readRoomAvailabilityFromInsForge({
  getClient,
}: {
  getClient: () => Promise<InsForgeServerClient>;
}) {
  try {
    const client = await getClient();
    const relatedData = await readRoomRelatedData(client);

    if (relatedData.error) {
      return relatedData;
    }

    return ok(buildDashboardRoomAvailability(relatedData.data));
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readMissingUtilityMetricsFromInsForge({
  getClient,
  billingPeriod,
}: {
  getClient: () => Promise<InsForgeServerClient>;
  billingPeriod: BillingPeriod;
}) {
  try {
    const client = await getClient();
    const [relatedData, metrics] = await Promise.all([
      readRoomRelatedData(client),
      client.database
        .from("utility_metrics")
        .select("id, room_id, month, year, electricity_old, electricity_new, water_old, water_new")
        .eq("month", billingPeriod.month)
        .eq("year", billingPeriod.year),
    ]);

    if (relatedData.error) {
      return relatedData;
    }

    if (metrics.error) {
      return fail(metrics.error, "Could not read Dashboard Utility Metrics");
    }

    return ok(
      buildDashboardMissingUtilityMetrics({
        ...relatedData.data,
        metrics: (metrics.data ?? []) as unknown as UtilityMetricRecord[],
        billingPeriod,
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readUnpaidInvoicesFromInsForge({
  getClient,
  billingPeriod,
}: {
  getClient: () => Promise<InsForgeServerClient>;
  billingPeriod: BillingPeriod;
}) {
  try {
    const client = await getClient();
    const [rooms, invoices] = await Promise.all([
      client.database.from("rooms").select("id, name").order("name"),
      client.database
        .from("invoices")
        .select(invoiceSelect)
        .eq("month", billingPeriod.month)
        .eq("year", billingPeriod.year)
        .order("year")
        .order("month"),
    ]);

    for (const response of [rooms, invoices]) {
      if (response.error) {
        return fail(response.error, "Could not read Dashboard unpaid Invoices");
      }
    }

    return ok(
      buildDashboardUnpaidInvoices({
        rooms: (rooms.data ?? []) as unknown as RoomRecord[],
        invoices: (invoices.data ?? []) as unknown as InvoiceRecord[],
        billingPeriod,
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readRoomRelatedData(
  client: InsForgeServerClient,
): Promise<
  AppResult<{
    rooms: RoomRecord[];
    activeContracts: ContractRecord[];
    tenants: TenantRecord[];
  }>
> {
  const [rooms, activeContracts, tenants] = await Promise.all([
    client.database
      .from("rooms")
      .select("id, name, status, base_price, created_at, updated_at")
      .order("name"),
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
    client.database
      .from("tenants")
      .select("id, room_id, full_name, phone, is_key_tenant, status")
      .order("full_name"),
  ]);

  for (const response of [rooms, activeContracts, tenants]) {
    if (response.error) {
      return fail(response.error, "Could not read Dashboard room data");
    }
  }

  return ok({
    rooms: (rooms.data ?? []) as unknown as RoomRecord[],
    activeContracts: (activeContracts.data ?? []) as unknown as ContractRecord[],
    tenants: (tenants.data ?? []) as unknown as TenantRecord[],
  });
}

const invoiceSelect = [
  "id",
  "room_id",
  "month",
  "year",
  "room_fee",
  "electricity_fee",
  "water_fee",
  "other_fee",
  "total_amount",
  "amount_paid",
  "status",
].join(", ");
