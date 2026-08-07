import type { BillingPeriod } from "@/lib/utilities/presenter";

export const dashboardQueryKeys = {
  all: ["dashboard"] as const,
  revenue: (billingPeriod?: BillingPeriod) =>
    billingPeriod
      ? ([
          ...dashboardQueryKeys.all,
          "revenue",
          billingPeriod.year,
          billingPeriod.month,
        ] as const)
      : ([...dashboardQueryKeys.all, "revenue"] as const),
  roomAvailability: () =>
    [...dashboardQueryKeys.all, "room-availability"] as const,
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
