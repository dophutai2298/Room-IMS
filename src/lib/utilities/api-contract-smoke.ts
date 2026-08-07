import type { ApiResponse } from "@/lib/api/response";
import type { UtilityMetricRecord } from "@/lib/insforge/types";
import type { UtilityMetricsView } from "./presenter";

const authenticatedUtilityMetricsScreenApiSmoke = {
  ok: true,
  data: {
    room: {
      id: "00000000-0000-0000-0000-000000000101",
      name: "P101",
    },
    billingPeriod: {
      month: 7,
      year: 2026,
    },
    periodLabel: "07/2026",
    persistedMetricId: "00000000-0000-0000-0000-000000000401",
    keyTenantName: "Tenant Demo",
    activeContractId: "00000000-0000-0000-0000-000000000301",
    previousPeriodLabel: null,
    invoice: null,
    electricity: {
      oldReading: 100,
      newReading: 120,
      consumption: 20,
      unit: "kWh",
    },
    water: {
      oldReading: 25,
      newReading: 30,
      consumption: 5,
      unit: "m³",
    },
  },
  meta: {
    timing: {
      operation: "utility-metrics.read",
      totalMs: 1,
      spans: [
        { name: "validation", durationMs: 1 },
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.utility-metrics-read", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<UtilityMetricsView>;

const savedUtilityMetricsApiSmoke = {
  ok: true,
  data: {
    id: "00000000-0000-0000-0000-000000000401",
    room_id: "00000000-0000-0000-0000-000000000101",
    month: 7,
    year: 2026,
    electricity_old: 100,
    electricity_new: 120,
    water_old: 25,
    water_new: 30,
  },
  meta: {
    timing: {
      operation: "utility-metrics.save",
      totalMs: 1,
      spans: [
        { name: "validation", durationMs: 1 },
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.utility-metrics-write", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<UtilityMetricRecord>;

const rejectedLowerReadingApiSmoke = {
  ok: false,
  error: {
    kind: "validation",
    code: "ELECTRICITY_READING_ROLLBACK",
    message: "New electricity reading cannot be lower than the previous reading.",
    status: 422,
  },
} satisfies ApiResponse<UtilityMetricRecord>;

const rejectedLowerWaterReadingApiSmoke = {
  ok: false,
  error: {
    kind: "validation",
    code: "WATER_READING_ROLLBACK",
    message: "New water reading cannot be lower than the previous reading.",
    status: 422,
  },
} satisfies ApiResponse<UtilityMetricRecord>;

export function getAuthenticatedUtilityMetricsApiSmokeResponses() {
  return {
    screen: authenticatedUtilityMetricsScreenApiSmoke,
    saved: savedUtilityMetricsApiSmoke,
    rejectedLowerReading: rejectedLowerReadingApiSmoke,
    rejectedLowerWaterReading: rejectedLowerWaterReadingApiSmoke,
  };
}
