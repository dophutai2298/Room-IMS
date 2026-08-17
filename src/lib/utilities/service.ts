import "server-only";

import type { AppResult } from "@/lib/insforge/errors";
import type { UtilityMetricRecord } from "@/lib/insforge/types";
import type { UtilityMetricsView } from "./presenter";
import type {
  ReadUtilityMetricsScreenInput,
  SaveUtilityMetricsInput,
  UtilityMetricsRepository,
} from "./repository";

export async function getUtilityMetricsForOperations({
  repository,
  roomId,
  billingPeriod,
}: ReadUtilityMetricsScreenInput & {
  repository: UtilityMetricsRepository;
}): Promise<AppResult<UtilityMetricsView>> {
  return repository.readUtilityMetricsScreen({
    roomId,
    billingPeriod,
  });
}

export async function saveUtilityMetricsForOperations({
  repository,
  roomId,
  allowUpdateExisting,
  billingPeriod,
  electricityNew,
  waterNew,
}: SaveUtilityMetricsInput & {
  repository: UtilityMetricsRepository;
}): Promise<AppResult<UtilityMetricRecord>> {
  return repository.saveUtilityMetrics({
    roomId,
    allowUpdateExisting,
    billingPeriod,
    electricityNew,
    waterNew,
  });
}
