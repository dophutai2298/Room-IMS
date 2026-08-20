import type { ApiResponse } from "@/lib/api/response";
import type {
  DashboardMissingUtilityMetricsView,
  DashboardRevenueView,
  DashboardUnpaidInvoicesView,
} from "./presenter";

export function getAuthenticatedDashboardApiSmokeResponses() {
  return {
    revenue: authenticatedRevenueApiSmoke,
    missingUtilityMetrics: authenticatedMissingUtilityMetricsApiSmoke,
    unpaidInvoices: authenticatedUnpaidInvoicesApiSmoke,
  };
}

const authenticatedRevenueApiSmoke = {
  ok: true,
  data: {
    billingPeriod: { month: 8, year: 2026 },
    periodLabel: "08/2026",
    billedRevenue: 6_040_000,
    collectedRevenue: 3_020_000,
    outstandingDebt: 3_020_000,
    invoiceCount: 2,
    chartRange: "6m",
    chartInvoiceCount: 2,
    chart: [
      { period: "03/2026", billingPeriod: { month: 3, year: 2026 }, billed: 0, collected: 0 },
      { period: "04/2026", billingPeriod: { month: 4, year: 2026 }, billed: 0, collected: 0 },
      { period: "05/2026", billingPeriod: { month: 5, year: 2026 }, billed: 0, collected: 0 },
      { period: "06/2026", billingPeriod: { month: 6, year: 2026 }, billed: 0, collected: 0 },
      { period: "07/2026", billingPeriod: { month: 7, year: 2026 }, billed: 3_020_000, collected: 1_000_000 },
      { period: "08/2026", billingPeriod: { month: 8, year: 2026 }, billed: 6_040_000, collected: 3_020_000 },
    ],
  },
  meta: {
    timing: {
      operation: "dashboard.revenue",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.dashboard-revenue", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<DashboardRevenueView>;

const authenticatedMissingUtilityMetricsApiSmoke = {
  ok: true,
  data: {
    billingPeriod: { month: 8, year: 2026 },
    periodLabel: "08/2026",
    rooms: [
      {
        id: "00000000-0000-0000-0000-000000000101",
        name: "P101",
        keyTenantName: "Nguyen Van A",
        basePrice: 2_500_000,
      },
    ],
  },
  meta: {
    timing: {
      operation: "dashboard.missing-utility-metrics",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.dashboard-missing-utility-metrics", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<DashboardMissingUtilityMetricsView>;

const authenticatedUnpaidInvoicesApiSmoke = {
  ok: true,
  data: {
    billingPeriod: { month: 8, year: 2026 },
    periodLabel: "08/2026",
    totalBalanceDue: 3_020_000,
    invoices: [
      {
        id: "00000000-0000-0000-0000-000000000501",
        shortId: "INV-2608-00000000",
        roomId: "00000000-0000-0000-0000-000000000101",
        roomName: "P101",
        status: "Unpaid",
        totalAmount: 3_020_000,
        amountPaid: 0,
        balanceDue: 3_020_000,
      },
    ],
  },
  meta: {
    timing: {
      operation: "dashboard.unpaid-invoices",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.dashboard-unpaid-invoices", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<DashboardUnpaidInvoicesView>;
