import type { AppResult } from "@/lib/insforge/errors";
import type { BillingPeriod } from "@/lib/utilities/presenter";
import type {
  DashboardMissingUtilityMetricsView,
  DashboardOperationsSummaryView,
  DashboardRevenueView,
  DashboardUnpaidInvoicesView,
} from "./presenter";
import type { DashboardRevenueRange } from "./revenue-range";

export type DashboardRepository = {
  readOperationsSummary(
    billingPeriod: BillingPeriod,
  ): Promise<AppResult<DashboardOperationsSummaryView>>;
  readRevenueSummary(
    billingPeriod: BillingPeriod,
    chartRange: DashboardRevenueRange,
  ): Promise<AppResult<DashboardRevenueView>>;
  readMissingUtilityMetrics(
    billingPeriod: BillingPeriod,
  ): Promise<AppResult<DashboardMissingUtilityMetricsView>>;
  readUnpaidInvoices(
    billingPeriod: BillingPeriod,
  ): Promise<AppResult<DashboardUnpaidInvoicesView>>;
};
