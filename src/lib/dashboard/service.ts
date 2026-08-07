import "server-only";

import type { BillingPeriod } from "@/lib/utilities/presenter";
import type { DashboardRepository } from "./repository";

export async function getDashboardRevenueForOperations({
  repository,
  billingPeriod,
}: {
  repository: DashboardRepository;
  billingPeriod: BillingPeriod;
}) {
  return repository.readRevenueSummary(billingPeriod);
}

export async function getDashboardRoomAvailabilityForOperations({
  repository,
}: {
  repository: DashboardRepository;
}) {
  return repository.readRoomAvailability();
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
