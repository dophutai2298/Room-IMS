import type { AppResult } from "@/lib/insforge/errors";
import type { UtilityMetricRecord } from "@/lib/insforge/types";
import type { BillingPeriod, UtilityMetricsView } from "./presenter";

export type ReadUtilityMetricsScreenInput = {
  roomId: string;
  billingPeriod: BillingPeriod;
};

export type SaveUtilityMetricsInput = ReadUtilityMetricsScreenInput & {
  electricityNew: number;
  waterNew: number;
  allowUpdateExisting?: boolean;
};

export type UtilityMetricsRepository = {
  readUtilityMetricsScreen(
    input: ReadUtilityMetricsScreenInput,
  ): Promise<AppResult<UtilityMetricsView>>;
  saveUtilityMetrics(
    input: SaveUtilityMetricsInput,
  ): Promise<AppResult<UtilityMetricRecord>>;
};
