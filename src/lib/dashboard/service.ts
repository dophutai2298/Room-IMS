import "server-only";

import type { BillingPeriod } from "@/lib/utilities/presenter";
import type { DashboardRepository } from "./repository";
import type { DashboardRevenueRange } from "./revenue-range";

export async function getDashboardOperationsSummaryForOperations({
  repository,
  billingPeriod,
}: {
  repository: DashboardRepository;
  billingPeriod: BillingPeriod;
}) {
  return repository.readOperationsSummary(billingPeriod);
}

export async function getDashboardRevenueForOperations({
  repository,
  billingPeriod,
  chartRange,
}: {
  repository: DashboardRepository;
  billingPeriod: BillingPeriod;
  chartRange: DashboardRevenueRange;
}) {
  return repository.readRevenueSummary(billingPeriod, chartRange);
}

export async function getDashboardMissingUtilityMetricsForOperations({
  repository,
  billingPeriod,
}: {
  repository: DashboardRepository;
  billingPeriod: BillingPeriod;
}) {
  return repository.readMissingUtilityMetrics(billingPeriod);
}

export async function getDashboardUnpaidInvoicesForOperations({
  repository,
  billingPeriod,
}: {
  repository: DashboardRepository;
  billingPeriod: BillingPeriod;
}) {
  return repository.readUnpaidInvoices(billingPeriod);
}
