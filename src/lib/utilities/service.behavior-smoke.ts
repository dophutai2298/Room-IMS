import "server-only";

import type { AppResult } from "@/lib/insforge/errors";
import type { UtilityMetricRecord } from "@/lib/insforge/types";
import type { UtilityMetricsView } from "./presenter";
import { saveUtilityMetricsForOperations } from "./service";
import type { SaveUtilityMetricsInput, UtilityMetricsRepository } from "./repository";

const smokeMetric: UtilityMetricRecord = {
  id: "00000000-0000-0000-0000-000000000401",
  room_id: "00000000-0000-0000-0000-000000000101",
  month: 7,
  year: 2026,
  electricity_old: 100,
  electricity_new: 120,
  water_old: 25,
  water_new: 30,
};

const smokeInput: SaveUtilityMetricsInput = {
  roomId: smokeMetric.room_id,
  billingPeriod: {
    month: smokeMetric.month,
    year: smokeMetric.year,
  },
  electricityNew: smokeMetric.electricity_new,
  waterNew: smokeMetric.water_new,
};

export async function runUtilityMetricsServiceBehaviorSmoke(): Promise<{
  validSave: AppResult<UtilityMetricRecord>;
  rejectedLowerElectricity: AppResult<UtilityMetricRecord>;
  rejectedLowerWater: AppResult<UtilityMetricRecord>;
}> {
  return {
    validSave: await saveUtilityMetricsForOperations({
      repository: createSmokeRepository(ok(smokeMetric)),
      ...smokeInput,
    }),
    rejectedLowerElectricity: await saveUtilityMetricsForOperations({
      repository: createSmokeRepository(
        fail({
          code: "ELECTRICITY_READING_ROLLBACK",
          message: "Chỉ số điện mới không được thấp hơn chỉ số điện cũ.",
          statusCode: 422,
        }),
      ),
      ...smokeInput,
      electricityNew: 99,
    }),
    rejectedLowerWater: await saveUtilityMetricsForOperations({
      repository: createSmokeRepository(
        fail({
          code: "WATER_READING_ROLLBACK",
          message: "Chỉ số nước mới không được thấp hơn chỉ số nước cũ.",
          statusCode: 422,
        }),
      ),
      ...smokeInput,
      waterNew: 24,
    }),
  };
}

function createSmokeRepository(
  saveResult: AppResult<UtilityMetricRecord>,
): UtilityMetricsRepository {
  return {
    async readUtilityMetricsScreen(): Promise<AppResult<UtilityMetricsView>> {
      return fail({
        code: "SMOKE_READ_NOT_USED",
        message: "Read is outside this behavior smoke.",
        statusCode: 500,
      });
    },
    async saveUtilityMetrics() {
      return saveResult;
    },
  };
}

function ok<T>(data: T): AppResult<T> {
  return {
    data,
    error: null,
  };
}

function fail<T = never>(error: {
  code: string;
  message: string;
  statusCode: number;
}): AppResult<T> {
  return {
    data: null,
    error,
  };
}
