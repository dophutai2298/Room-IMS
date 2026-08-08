import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import {
  buildDashboardMissingUtilityMetricsFromItems,
  buildDashboardRevenue,
  buildDashboardUnpaidInvoices,
} from "@/lib/dashboard/presenter";
import type { DashboardRepository } from "@/lib/dashboard/repository";
import type { BillingPeriod } from "@/lib/utilities/presenter";
import { fail, ok, toAppBackendError } from "./errors";
import { createInsForgeRoomRepository } from "./room-repository";
import { createInsForgeServerClient } from "./server";
import type { InvoiceRecord, RoomRecord, UtilityMetricRecord } from "./types";

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
  const roomRepository = createInsForgeRoomRepository({ timer });

  return {
    async readRevenueSummary(billingPeriod) {
      const query = () => readRevenueSummaryFromInsForge({ getClient, billingPeriod });

      return timer
        ? timer.measure("repository.insforge.dashboard-revenue", query)
        : query();
    },
    async readMissingUtilityMetrics(billingPeriod) {
      const query = () =>
        readMissingUtilityMetricsFromInsForge({
          getClient,
          roomRepository,
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

async function readMissingUtilityMetricsFromInsForge({
  getClient,
  roomRepository,
  billingPeriod,
}: {
  getClient: () => Promise<InsForgeServerClient>;
  roomRepository: ReturnType<typeof createInsForgeRoomRepository>;
  billingPeriod: BillingPeriod;
}) {
  try {
    const client = await getClient();
    const [rooms, metrics] = await Promise.all([
      roomRepository.listRoomItems(),
      client.database
        .from("utility_metrics")
        .select("id, room_id, month, year, electricity_old, electricity_new, water_old, water_new")
        .eq("month", billingPeriod.month)
        .eq("year", billingPeriod.year),
    ]);

    if (rooms.error) {
      return rooms;
    }

    if (metrics.error) {
      return fail(metrics.error, "Could not read Dashboard Utility Metrics");
    }

    return ok(
      buildDashboardMissingUtilityMetricsFromItems({
        roomItems: rooms.data,
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
