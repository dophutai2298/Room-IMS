import type { BillingPeriod } from "@/lib/utilities/presenter";
import {
  DEFAULT_DASHBOARD_REVENUE_RANGE,
  type DashboardRevenueRange,
} from "./revenue-range";

export const dashboardQueryKeys = {
  all: ["dashboard"] as const,
  operationsSummary: (billingPeriod?: BillingPeriod) =>
    billingPeriod
      ? ([
          ...dashboardQueryKeys.all,
          "operations-summary",
          billingPeriod.year,
          billingPeriod.month,
        ] as const)
      : ([...dashboardQueryKeys.all, "operations-summary"] as const),
  revenue: (
    billingPeriod?: BillingPeriod,
    chartRange: DashboardRevenueRange = DEFAULT_DASHBOARD_REVENUE_RANGE,
  ) =>
    billingPeriod
      ? ([
          ...dashboardQueryKeys.all,
          "revenue",
          billingPeriod.year,
          billingPeriod.month,
          chartRange,
        ] as const)
      : ([...dashboardQueryKeys.all, "revenue", chartRange] as const),
  missingUtilityMetrics: (billingPeriod?: BillingPeriod) =>
    billingPeriod
      ? ([
          ...dashboardQueryKeys.all,
          "missing-utility-metrics",
          billingPeriod.year,
          billingPeriod.month,
        ] as const)
      : ([...dashboardQueryKeys.all, "missing-utility-metrics"] as const),
  unpaidInvoices: (billingPeriod?: BillingPeriod) =>
    billingPeriod
      ? ([
          ...dashboardQueryKeys.all,
          "unpaid-invoices",
          billingPeriod.year,
          billingPeriod.month,
        ] as const)
      : ([...dashboardQueryKeys.all, "unpaid-invoices"] as const),
};
