import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DASHBOARD_REVENUE_RANGE,
  normalizeDashboardRevenueRange,
} from "./revenue-range";
import { getDashboardRevenueRangeFromRequest } from "./api";
import { buildDashboardRevenue } from "./presenter";
import { dashboardQueryKeys } from "./query-keys";
import type { InvoiceRecord } from "@/lib/insforge/types";

const billingPeriod = { month: 8, year: 2026 };

test("dashboard revenue range normalizes supported values and safely falls back to six months", () => {
  assert.equal(DEFAULT_DASHBOARD_REVENUE_RANGE, "6m");
  assert.equal(normalizeDashboardRevenueRange("3m"), "3m");
  assert.equal(normalizeDashboardRevenueRange("6m"), "6m");
  assert.equal(normalizeDashboardRevenueRange("1y"), "1y");
  assert.equal(normalizeDashboardRevenueRange("2y"), "2y");
  assert.equal(normalizeDashboardRevenueRange("all"), "all");
  assert.equal(normalizeDashboardRevenueRange("invalid"), "6m");
  assert.equal(normalizeDashboardRevenueRange(null), "6m");

  const fallbackRevenue = buildDashboardRevenue({
    invoices: [],
    billingPeriod,
    chartRange: "invalid",
  });
  assert.equal(fallbackRevenue.chartRange, "6m");
  assert.equal(fallbackRevenue.chart.length, 6);
});

test("dashboard revenue range keeps separate React Query cache keys", () => {
  assert.notDeepEqual(
    dashboardQueryKeys.revenue(billingPeriod, "3m"),
    dashboardQueryKeys.revenue(billingPeriod, "6m"),
  );
  assert.deepEqual(
    dashboardQueryKeys.revenue(billingPeriod),
    dashboardQueryKeys.revenue(billingPeriod, "6m"),
  );
});

test("all dashboard revenue range retains a no-data state when no invoice history exists", () => {
  const revenue = buildDashboardRevenue({
    invoices: [],
    billingPeriod,
    chartRange: "all",
  });

  assert.equal(revenue.chartInvoiceCount, 0);
  assert.deepEqual(revenue.chart, []);
});

test("dashboard revenue API request normalizes an invalid range to six months", () => {
  assert.equal(
    getDashboardRevenueRangeFromRequest(
      new Request("http://localhost/api/dashboard/revenue?range=2y"),
    ),
    "2y",
  );
  assert.equal(
    getDashboardRevenueRangeFromRequest(
      new Request("http://localhost/api/dashboard/revenue?range=not-a-range"),
    ),
    "6m",
  );
});

test("fixed dashboard chart ranges create contiguous zero-filled monthly buckets", () => {
  const invoices = [
    createInvoice({ month: 5, year: 2026, total_amount: 500, amount_paid: 200 }),
    createInvoice({ month: 7, year: 2026, total_amount: 700, amount_paid: 300 }),
    createInvoice({ month: 8, year: 2026, total_amount: 800, amount_paid: 800 }),
  ];

  const threeMonths = buildDashboardRevenue({
    invoices,
    billingPeriod,
    chartRange: "3m",
  });
  const sixMonths = buildDashboardRevenue({
    invoices,
    billingPeriod,
    chartRange: "6m",
  });
  const oneYear = buildDashboardRevenue({
    invoices,
    billingPeriod,
    chartRange: "1y",
  });
  const twoYears = buildDashboardRevenue({
    invoices,
    billingPeriod,
    chartRange: "2y",
  });

  assert.deepEqual(
    threeMonths.chart.map((point) => point.period),
    ["06/2026", "07/2026", "08/2026"],
  );
  assert.deepEqual(
    threeMonths.chart.map((point) => point.billed),
    [0, 700, 800],
  );
  assert.equal(sixMonths.chart.length, 6);
  assert.equal(sixMonths.chart[0]?.period, "03/2026");
  assert.equal(sixMonths.chart[2]?.billed, 500);
  assert.equal(oneYear.chart.length, 12);
  assert.equal(oneYear.chart[0]?.period, "09/2025");
  assert.equal(twoYears.chart.length, 24);
  assert.equal(twoYears.chart[0]?.period, "09/2024");
  assert.equal(twoYears.chart.at(-1)?.period, "08/2026");
  assert.equal(twoYears.chart.find((point) => point.period === "06/2026")?.billed, 0);
});

test("all dashboard revenue range returns full chronological invoice history with missing months filled", () => {
  const revenue = buildDashboardRevenue({
    invoices: [
      createInvoice({ month: 11, year: 2024, total_amount: 110, amount_paid: 100 }),
      createInvoice({ month: 2, year: 2025, total_amount: 220, amount_paid: 120 }),
      createInvoice({ month: 8, year: 2026, total_amount: 880, amount_paid: 800 }),
    ],
    billingPeriod,
    chartRange: "all",
  });

  assert.equal(revenue.chartRange, "all");
  assert.equal(revenue.chartInvoiceCount, 3);
  assert.equal(revenue.chart[0]?.period, "11/2024");
  assert.equal(revenue.chart.at(-1)?.period, "08/2026");
  assert.deepEqual(
    revenue.chart.find((point) => point.period === "12/2024"),
    {
      period: "12/2024",
      billingPeriod: { month: 12, year: 2024 },
      billed: 0,
      collected: 0,
    },
  );
});

function createInvoice(
  overrides: Partial<InvoiceRecord> = {},
): InvoiceRecord {
  return {
    id: "00000000-0000-0000-0000-000000000501",
    room_id: "00000000-0000-0000-0000-000000000101",
    month: 8,
    year: 2026,
    room_fee: 0,
    electricity_fee: 0,
    water_fee: 0,
    other_fee: 0,
    other_fee_note: null,
    total_amount: 0,
    amount_paid: 0,
    status: "Unpaid",
    ...overrides,
  };
}
