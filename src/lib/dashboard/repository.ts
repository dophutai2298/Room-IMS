import type { AppResult } from "@/lib/insforge/errors";
import type { BillingPeriod } from "@/lib/utilities/presenter";
import type {
  DashboardMissingUtilityMetricsView,
  DashboardRevenueView,
  DashboardRoomAvailabilityView,
  DashboardUnpaidInvoicesView,
} from "./presenter";

export type DashboardRepository = {
  readRevenueSummary(
    billingPeriod: BillingPeriod,
  ): Promise<AppResult<DashboardRevenueView>>;
  readRoomAvailability(): Promise<AppResult<DashboardRoomAvailabilityView>>;
  readMissingUtilityMetrics(
    billingPeriod: BillingPeriod,
  ): Promise<AppResult<DashboardMissingUtilityMetricsView>>;
  readUnpaidInvoices(
    billingPeriod: BillingPeriod,
  ): Promise<AppResult<DashboardUnpaidInvoicesView>>;
};
