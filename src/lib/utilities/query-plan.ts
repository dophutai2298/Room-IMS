import type { BillingPeriod } from "./presenter";

export function getUtilityMetricReadPlan(billingPeriod: BillingPeriod) {
  return {
    current: {
      year: billingPeriod.year,
      month: billingPeriod.month,
    },
    earlierThisYear: {
      year: billingPeriod.year,
      beforeMonth: billingPeriod.month,
    },
    priorYears: {
      beforeYear: billingPeriod.year,
    },
  };
}
