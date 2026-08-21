import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import {
  buildDashboardMissingUtilityMetricsFromCompactRows,
  buildDashboardOperationsSummaryFromCompactRows,
  buildDashboardRevenue,
  buildDashboardUnpaidInvoices,
} from "@/lib/dashboard/presenter";
import type { DashboardRepository } from "@/lib/dashboard/repository";
import {
  DEFAULT_DASHBOARD_REVENUE_RANGE,
  getDashboardRevenueQuerySegments,
  type DashboardRevenueRange,
} from "@/lib/dashboard/revenue-range";
import type { BillingPeriod } from "@/lib/utilities/presenter";
import { fail, ok, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import type {
  ContractRecord,
  InvoiceRecord,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
} from "./types";

type InsForgeServerClient = Awaited<ReturnType<typeof createInsForgeServerClient>>;

type QueryResponse<T> = {
  data: T | null;
  error: unknown;
};

export function createInsForgeDashboardRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): DashboardRepository {
  let clientPromise: Promise<InsForgeServerClient> | null = null;
  const getClient = () => {
    clientPromise ??= createInsForgeServerClient({ timer });
    return clientPromise;
  };
  return {
    async readOperationsSummary(billingPeriod) {
      const query = () =>
        readOperationsSummaryFromInsForge({
          getClient,
          billingPeriod,
        });

      return timer
        ? timer.measure("repository.insforge.dashboard-operations-summary", query)
        : query();
    },
    async readRevenueSummary(billingPeriod, chartRange) {
      const query = () =>
        readRevenueSummaryFromInsForge({
          getClient,
          billingPeriod,
          chartRange,
        });

      return timer
        ? timer.measure("repository.insforge.dashboard-revenue", query)
        : query();
    },
    async readMissingUtilityMetrics(billingPeriod) {
      const query = () =>
        readMissingUtilityMetricsFromInsForge({
          getClient,
          billingPeriod,
        });

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
  chartRange,
}: {
  getClient: () => Promise<InsForgeServerClient>;
  billingPeriod: BillingPeriod;
  chartRange: DashboardRevenueRange;
}) {
  try {
    const client = await getClient();
    const response = await readRevenueInvoices({
      client,
      billingPeriod,
      chartRange,
    });

    if (response.error) {
      return fail(response.error, "Could not read Dashboard revenue");
    }

    return ok(
      buildDashboardRevenue({
        invoices: (response.data ?? []) as unknown as InvoiceRecord[],
        billingPeriod,
        chartRange,
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readOperationsSummaryFromInsForge({
  getClient,
  billingPeriod,
}: {
  getClient: () => Promise<InsForgeServerClient>;
  billingPeriod: BillingPeriod;
}) {
  try {
    const client = await getClient();
    const [rooms, tenants, activeContracts, metrics, invoices] = await Promise.all([
      client.database
        .from("rooms")
        .select("id, name, status, base_price")
        .order("name"),
      client.database.from("tenants").select("id, full_name").order("full_name"),
      client.database
        .from("contracts")
        .select("id, room_id, key_tenant_id, rent_amount")
        .eq("status", "Active")
        .order("start_date"),
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
        .eq("month", billingPeriod.month)
        .eq("year", billingPeriod.year),
      readRevenueInvoices({
        client,
        billingPeriod,
        chartRange: DEFAULT_DASHBOARD_REVENUE_RANGE,
      }),
    ]);

    for (const response of [rooms, tenants, activeContracts, metrics, invoices]) {
      if (response.error) {
        return fail(response.error, "Could not read Dashboard operations summary");
      }
    }

    return ok(
      buildDashboardOperationsSummaryFromCompactRows({
        rooms: (rooms.data ?? []) as unknown as Pick<
          RoomRecord,
          "id" | "name" | "status" | "base_price"
        >[],
        activeContracts: (activeContracts.data ?? []) as unknown as Pick<
          ContractRecord,
          "id" | "room_id" | "key_tenant_id" | "rent_amount"
        >[],
        tenants: (tenants.data ?? []) as unknown as Pick<
          TenantRecord,
          "id" | "full_name"
        >[],
        metrics: (metrics.data ?? []) as unknown as UtilityMetricRecord[],
        invoices: (invoices.data ?? []) as unknown as InvoiceRecord[],
        billingPeriod,
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readRevenueInvoices({
  client,
  billingPeriod,
  chartRange,
}: {
  client: InsForgeServerClient;
  billingPeriod: BillingPeriod;
  chartRange: DashboardRevenueRange;
}) {
  const segments = getDashboardRevenueQuerySegments(
    billingPeriod,
    chartRange,
  );

  if (!segments) {
    return client.database
      .from("invoices")
      .select(invoiceSelect)
      .order("year")
      .order("month") as PromiseLike<QueryResponse<InvoiceRecord[]>>;
  }

  const responses = (await Promise.all(
    segments.map(({ year, startMonth, endMonth }) =>
      client.database
        .from("invoices")
        .select(invoiceSelect)
        .eq("year", year)
        .gte("month", startMonth)
        .lte("month", endMonth)
        .order("month"),
    ),
  )) as QueryResponse<InvoiceRecord[]>[];
  const failedResponse = responses.find((response) => response.error);

  return {
    data: failedResponse
      ? null
      : responses.flatMap((response) => response.data ?? []),
    error: failedResponse?.error ?? null,
  };
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
    const [rooms, tenants, activeContracts, metrics] = await Promise.all([
      client.database.from("rooms").select("id, name, status, base_price").order("name"),
      client.database.from("tenants").select("id, full_name").order("full_name"),
      client.database
        .from("contracts")
        .select("id, room_id, key_tenant_id, rent_amount")
        .eq("status", "Active")
        .order("start_date"),
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
        .eq("month", billingPeriod.month)
        .eq("year", billingPeriod.year),
    ]);

    for (const response of [rooms, tenants, activeContracts, metrics]) {
      if (response.error) {
        return fail(response.error, "Could not read Dashboard Utility Metrics");
      }
    }

    return ok(
      buildDashboardMissingUtilityMetricsFromCompactRows({
        rooms: (rooms.data ?? []) as unknown as Pick<
          RoomRecord,
          "id" | "name" | "status" | "base_price"
        >[],
        activeContracts: (activeContracts.data ?? []) as unknown as Pick<
          ContractRecord,
          "id" | "room_id" | "key_tenant_id" | "rent_amount"
        >[],
        tenants: (tenants.data ?? []) as unknown as Pick<
          TenantRecord,
          "id" | "full_name"
        >[],
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
].join(", ");
