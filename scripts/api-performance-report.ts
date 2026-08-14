export type ApiTimingSpan = {
  name: string;
  durationMs: number;
  attributes?: Record<string, string | number | boolean | null>;
};

export type ApiTimingSnapshot = {
  requestId?: string;
  operation: string;
  totalMs: number;
  spans: ApiTimingSpan[];
};

export type ApiPerformanceEndpoint = {
  key: string;
  name: string;
  method: "GET" | "POST";
  path: string;
};

export type ApiPerformanceSample = {
  status: number;
  durationMs: number;
  payloadBytes: number;
  timing?: ApiTimingSnapshot;
};

export type ApiPerformanceSummary = {
  key: string;
  endpoint: string;
  method: ApiPerformanceEndpoint["method"];
  path: string;
  status: string;
  coldMs: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  samples: number;
  p50PayloadBytes: number;
  largestSpan: string;
};

export type ApiPerformanceReport = {
  version: 1;
  generatedAt: string;
  baseUrl: string;
  results: ApiPerformanceSummary[];
};

export type ApiPerformanceComparison = {
  endpoint: string;
  statusBefore: string;
  statusAfter: string;
  samplesBefore: number;
  samplesAfter: number;
  minBeforeMs: number;
  minAfterMs: number;
  p50BeforeMs: number;
  p50AfterMs: number;
  p50DeltaMs: number;
  p95BeforeMs: number;
  p95AfterMs: number;
  p95DeltaMs: number;
  maxBeforeMs: number;
  maxAfterMs: number;
};

export function summarizeEndpointSamples({
  endpoint,
  cold,
  warm,
}: {
  endpoint: ApiPerformanceEndpoint;
  cold: ApiPerformanceSample;
  warm: ApiPerformanceSample[];
}): ApiPerformanceSummary {
  const durations = warm.map((sample) => sample.durationMs).sort(sortNumber);
  const payloadSizes = warm.map((sample) => sample.payloadBytes).sort(sortNumber);

  return {
    key: endpoint.key,
    endpoint: endpoint.name,
    method: endpoint.method,
    path: endpoint.path,
    status:
      Array.from(new Set(warm.map((sample) => sample.status))).join(",") ||
      String(cold.status),
    coldMs: cold.durationMs,
    minMs: percentile(durations, 0),
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    maxMs: percentile(durations, 100),
    samples: warm.length,
    p50PayloadBytes: percentile(payloadSizes, 50),
    largestSpan: findLargestSpan(warm),
  };
}

export function comparePerformanceReports(
  before: ApiPerformanceReport,
  after: ApiPerformanceReport,
): ApiPerformanceComparison[] {
  const beforeByKey = new Map(before.results.map((result) => [result.key, result]));
  const afterByKey = new Map(after.results.map((result) => [result.key, result]));
  const missingBefore = after.results
    .filter((result) => !beforeByKey.has(result.key))
    .map((result) => result.key);
  const missingAfter = before.results
    .filter((result) => !afterByKey.has(result.key))
    .map((result) => result.key);

  if (missingBefore.length > 0 || missingAfter.length > 0) {
    throw new Error(
      `Performance reports cover different endpoints. Missing before: ${
        missingBefore.join(",") || "none"
      }; missing after: ${missingAfter.join(",") || "none"}.`,
    );
  }

  return after.results.map((afterResult) => {
    const beforeResult = beforeByKey.get(afterResult.key);

    if (!beforeResult) {
      throw new Error(`Missing before result for ${afterResult.key}.`);
    }

    return {
      endpoint: afterResult.endpoint,
      statusBefore: beforeResult.status,
      statusAfter: afterResult.status,
      samplesBefore: beforeResult.samples,
      samplesAfter: afterResult.samples,
      minBeforeMs: beforeResult.minMs,
      minAfterMs: afterResult.minMs,
      p50BeforeMs: beforeResult.p50Ms,
      p50AfterMs: afterResult.p50Ms,
      p50DeltaMs: roundDuration(afterResult.p50Ms - beforeResult.p50Ms),
      p95BeforeMs: beforeResult.p95Ms,
      p95AfterMs: afterResult.p95Ms,
      p95DeltaMs: roundDuration(afterResult.p95Ms - beforeResult.p95Ms),
      maxBeforeMs: beforeResult.maxMs,
      maxAfterMs: afterResult.maxMs,
    };
  });
}

export function parsePerformanceReport(value: unknown): ApiPerformanceReport {
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    value.version !== 1 ||
    !("results" in value) ||
    !Array.isArray(value.results)
  ) {
    throw new Error("Performance report has an unsupported shape.");
  }

  return value as ApiPerformanceReport;
}

function findLargestSpan(samples: ApiPerformanceSample[]) {
  const durationByName = new Map<string, number[]>();

  for (const span of samples.flatMap((sample) => sample.timing?.spans ?? [])) {
    const durations = durationByName.get(span.name) ?? [];
    durations.push(span.durationMs);
    durationByName.set(span.name, durations);
  }

  const largest = Array.from(durationByName.entries())
    .map(([name, durations]) => ({
      name,
      p50Ms: percentile(durations.sort(sortNumber), 50),
    }))
    .sort((left, right) => right.p50Ms - left.p50Ms)[0];

  return largest ? `${largest.name}:${largest.p50Ms}ms p50` : "n/a";
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return 0;
  }

  if (percentileValue <= 0) {
    return values[0] ?? 0;
  }

  if (percentileValue >= 100) {
    return values[values.length - 1] ?? 0;
  }

  const index = Math.ceil((percentileValue / 100) * values.length) - 1;
  return values[Math.max(0, index)] ?? 0;
}

function sortNumber(left: number, right: number) {
  return left - right;
}

function roundDuration(value: number) {
  return Math.round(value * 100) / 100;
}
