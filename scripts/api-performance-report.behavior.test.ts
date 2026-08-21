import assert from "node:assert/strict";
import test from "node:test";

import {
  comparePerformanceReports,
  summarizeEndpointSamples,
  type ApiPerformanceReport,
} from "./api-performance-report";

test("performance summary reports status, sample count, and latency distribution", () => {
  const summary = summarizeEndpointSamples({
    endpoint: {
      key: "invoices-list",
      name: "Invoices list",
      method: "GET",
      path: "/api/invoices",
    },
    cold: {
      status: 200,
      durationMs: 650,
      payloadBytes: 1200,
    },
    warm: [100, 500, 300, 200, 400].map((durationMs) => ({
      status: 200,
      durationMs,
      payloadBytes: 1000,
    })),
  });

  assert.deepEqual(summary, {
    key: "invoices-list",
    endpoint: "Invoices list",
    method: "GET",
    path: "/api/invoices",
    status: "200",
    coldMs: 650,
    minMs: 100,
    p50Ms: 300,
    p95Ms: 500,
    maxMs: 500,
    samples: 5,
    p50PayloadBytes: 1000,
    largestSpan: "n/a",
    slowestSample: "client:500ms; server:n/a",
  });
});

test("performance comparison keeps before and after values for every required metric", () => {
  const before = reportWithSummary({
    status: "200",
    minMs: 800,
    p50Ms: 1000,
    p95Ms: 1200,
    maxMs: 1300,
    samples: 5,
  });
  const after = reportWithSummary({
    status: "200",
    minMs: 400,
    p50Ms: 500,
    p95Ms: 700,
    maxMs: 800,
    samples: 7,
  });

  assert.deepEqual(comparePerformanceReports(before, after), [
    {
      endpoint: "Invoices list",
      statusBefore: "200",
      statusAfter: "200",
      samplesBefore: 5,
      samplesAfter: 7,
      minBeforeMs: 800,
      minAfterMs: 400,
      p50BeforeMs: 1000,
      p50AfterMs: 500,
      p50DeltaMs: -500,
      p95BeforeMs: 1200,
      p95AfterMs: 700,
      p95DeltaMs: -500,
      maxBeforeMs: 1300,
      maxAfterMs: 800,
    },
  ]);
});

test("performance comparison rejects incomplete endpoint coverage", () => {
  const before = reportWithSummary({
    status: "200",
    minMs: 800,
    p50Ms: 1000,
    p95Ms: 1200,
    maxMs: 1300,
    samples: 5,
  });
  const after = { ...before, results: [] };

  assert.throws(
    () => comparePerformanceReports(before, after),
    /Missing before: none; missing after: invoices-list/,
  );
});

function reportWithSummary(
  values: Pick<
    ApiPerformanceReport["results"][number],
    "status" | "minMs" | "p50Ms" | "p95Ms" | "maxMs" | "samples"
  >,
): ApiPerformanceReport {
  return {
    version: 1,
    generatedAt: "2026-08-14T00:00:00.000Z",
    baseUrl: "http://localhost:3000",
    results: [
      {
        key: "invoices-list",
        endpoint: "Invoices list",
        method: "GET",
        path: "/api/invoices",
        coldMs: 1400,
        p50PayloadBytes: 1000,
        largestSpan: "auth.session:800ms",
        slowestSample: "client:800ms; server:n/a",
        ...values,
      },
    ],
  };
}
