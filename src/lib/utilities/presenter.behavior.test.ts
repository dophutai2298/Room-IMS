import assert from "node:assert/strict";
import test from "node:test";

import type { UtilityMetricRecord } from "@/lib/insforge/types";
import { getUtilityMetricBaseline } from "./presenter";
import { getUtilityMetricReadPlan } from "./query-plan";

test("Utility Metrics query plan requests only current and latest earlier candidates", () => {
  assert.deepEqual(getUtilityMetricReadPlan({ month: 1, year: 2026 }), {
    current: { month: 1, year: 2026 },
    earlierThisYear: { year: 2026, beforeMonth: 1 },
    priorYears: { beforeYear: 2026 },
  });
});

test("Utility Metrics baseline ignores future rows and uses the latest historical reading", () => {
  const baseline = getUtilityMetricBaseline({
    billingPeriod: { month: 1, year: 2026 },
    metrics: [
      createMetric({ month: 12, year: 2026, electricity_new: 999, water_new: 99 }),
      createMetric({ month: 1, year: 2026, electricity_old: 120, water_old: 12 }),
      createMetric({ month: 10, year: 2025, electricity_new: 110, water_new: 11 }),
      createMetric({ month: 2, year: 2025, electricity_new: 20, water_new: 2 }),
    ],
  });

  assert.equal(baseline.currentMetric?.month, 1);
  assert.equal(baseline.electricityOld, 120);
  assert.equal(baseline.waterOld, 12);
});

test("Utility Metrics baseline can bridge a gap to the latest prior year", () => {
  const baseline = getUtilityMetricBaseline({
    billingPeriod: { month: 1, year: 2026 },
    metrics: [
      createMetric({ month: 10, year: 2025, electricity_new: 110, water_new: 11 }),
      createMetric({ month: 2, year: 2025, electricity_new: 20, water_new: 2 }),
    ],
  });

  assert.equal(baseline.currentMetric, null);
  assert.equal(baseline.electricityOld, 110);
  assert.equal(baseline.waterOld, 11);
});

function createMetric(
  overrides: Partial<UtilityMetricRecord>,
): UtilityMetricRecord {
  return {
    id: `${overrides.year}-${overrides.month}`,
    room_id: "room-1",
    month: 1,
    year: 2026,
    electricity_old: 0,
    electricity_new: 0,
    water_old: 0,
    water_new: 0,
    ...overrides,
  };
}
