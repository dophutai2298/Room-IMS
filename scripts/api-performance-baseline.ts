import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  comparePerformanceReports,
  parsePerformanceReport,
  summarizeEndpointSamples,
  type ApiPerformanceEndpoint,
  type ApiPerformanceReport,
  type ApiPerformanceSample,
  type ApiTimingSnapshot,
} from "./api-performance-report";

type ApiPayload = {
  ok?: boolean;
  meta?: { timing?: ApiTimingSnapshot };
};

const baseUrl =
  process.env.API_BASELINE_BASE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";
const cookie = process.env.NEXT_API_BASELINE_COOKIE;

const allowUnauthenticated =
  process.env.API_BASELINE_ALLOW_UNAUTHENTICATED === "true";
const samplesPerEndpoint = readPositiveInt("API_BASELINE_SAMPLES", 5);
const outputPath = resolve(
  process.env.API_BASELINE_OUTPUT ??
    ".scratch/performance/api-baseline-latest.json",
);
const beforePath = process.env.API_BASELINE_BEFORE
  ? resolve(process.env.API_BASELINE_BEFORE)
  : null;
const roomId = "00000000-0000-0000-0000-000000000101";
const tenantId = "10000000-0000-0000-0000-000000000001";
const month = readPositiveInt("API_BASELINE_MONTH", new Date().getMonth() + 1);
const year = readPositiveInt("API_BASELINE_YEAR", new Date().getFullYear());
const invoiceGenerationDurations = readDurationList(
  "API_BASELINE_INVOICE_GENERATION_SAMPLES",
);

const endpoints: ApiPerformanceEndpoint[] = [
  endpoint("foundation-current-user", "Foundation current user", "/api/foundation/current-user"),
  endpoint("foundation-seeded-data", "Foundation seeded data", "/api/foundation/seeded-data"),
  endpoint("rooms-list", "Rooms list", "/api/rooms"),
  endpoint("room-detail", "Room detail", `/api/rooms/${roomId}/detail`),
  endpoint(
    "room-operations-summary",
    "Room operations summary",
    `/api/rooms/${roomId}/operations-summary`,
  ),
  endpoint("room-tenants", "Room tenants", `/api/rooms/${roomId}/tenants`),
  endpoint("room-contracts", "Room contracts", `/api/rooms/${roomId}/contracts`),
  endpoint(
    "utility-metrics-read",
    "Utility Metrics read",
    `/api/rooms/${roomId}/utility-metrics?month=${month}&year=${year}`,
  ),
  endpoint("invoices-list", "Invoices list", "/api/invoices"),
  endpoint(
    "dashboard-revenue",
    "Dashboard revenue",
    `/api/dashboard/revenue?month=${month}&year=${year}`,
  ),
  endpoint(
    "dashboard-missing-utility-metrics",
    "Dashboard missing Utility Metrics",
    `/api/dashboard/missing-utility-metrics?month=${month}&year=${year}`,
  ),
  endpoint(
    "dashboard-unpaid-invoices",
    "Dashboard unpaid Invoices",
    `/api/dashboard/unpaid-invoices?month=${month}&year=${year}`,
  ),
  endpoint("tenants-directory", "Tenants directory", "/api/tenants"),
  endpoint("tenant-detail", "Tenant detail", `/api/tenants/${tenantId}`),
  endpoint("utility-pricing-list", "Utility Pricing list", "/api/utility-pricing"),
  endpoint("staff-list", "Staff list", "/api/staff"),
];

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`API performance baseline failed: ${message}`);
  process.exitCode = 1;
});

async function main() {
  console.info(`API baseline: ${baseUrl}`);
  console.info(
    `Samples: 1 cold + ${samplesPerEndpoint} warm per endpoint; month=${month}; year=${year}`,
  );

  if (!cookie && !allowUnauthenticated) {
    throw new Error(
      "Set NEXT_API_BASELINE_COOKIE to an authenticated browser Cookie header. Set API_BASELINE_ALLOW_UNAUTHENTICATED=true only for an intentional 401 Auth check.",
    );
  }

  if (!cookie) {
    console.warn(
      "Running an unauthenticated Auth-only check. Results are not a valid operational performance baseline.",
    );
  }

  const results: ApiPerformanceReport["results"] = [];

  for (const currentEndpoint of endpoints) {
    const cold = await requestEndpoint(currentEndpoint);

    if (
      currentEndpoint.key === "foundation-current-user" &&
      cold.status === 401 &&
      !allowUnauthenticated
    ) {
      throw new Error(
        "The configured baseline cookie is expired or invalid. Copy a fresh Cookie header from an authenticated browser request.",
      );
    }

    const warm: ApiPerformanceSample[] = [];

    for (let index = 0; index < samplesPerEndpoint; index += 1) {
      warm.push(await requestEndpoint(currentEndpoint));
    }

    results.push(
      summarizeEndpointSamples({ endpoint: currentEndpoint, cold, warm }),
    );
  }

  if (invoiceGenerationDurations.length >= 2) {
    const invoiceGenerationEndpoint: ApiPerformanceEndpoint = {
      key: "invoice-generation-action",
      name: "Invoice generation",
      method: "POST",
      path: "Server Action: generateMonthlyInvoice",
    };
    const [coldDuration = 0, ...warmDurations] = invoiceGenerationDurations;

    results.push(
      summarizeEndpointSamples({
        endpoint: invoiceGenerationEndpoint,
        cold: manualActionSample(coldDuration),
        warm: warmDurations.map(manualActionSample),
      }),
    );
  } else {
    console.warn(
      "Invoice generation is a mutating Server Action, so it is not repeated automatically. Run controlled UI submissions and set API_BASELINE_INVOICE_GENERATION_SAMPLES to comma-separated totalMs values (cold first, then warm).",
    );
  }

  const report: ApiPerformanceReport = {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseUrl,
    results,
  };

  console.table(results);
  await writeReport(report);

  if (beforePath) {
    const before = parsePerformanceReport(
      JSON.parse(await readFile(beforePath, "utf8")) as unknown,
    );
    console.info(`Before/after comparison: ${beforePath}`);
    console.table(comparePerformanceReports(before, report));
  }

  const unexpectedStatuses = results.filter((result) => result.status !== "200");

  if (unexpectedStatuses.length > 0 && !allowUnauthenticated) {
    throw new Error(
      `Unexpected HTTP status for: ${unexpectedStatuses
        .map((result) => `${result.endpoint} (${result.status})`)
        .join(", ")}`,
    );
  }

}

async function requestEndpoint(
  currentEndpoint: ApiPerformanceEndpoint,
): Promise<ApiPerformanceSample> {
  const url = new URL(currentEndpoint.path, baseUrl);
  const startedAt = performance.now();
  const response = await fetch(url, {
    method: currentEndpoint.method,
    headers: {
      Accept: "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  const responseBody = await response.text();
  const payload = parseApiPayload(responseBody);

  return {
    status: response.status,
    durationMs: roundDuration(performance.now() - startedAt),
    payloadBytes: Buffer.byteLength(responseBody),
    timing: payload?.meta?.timing,
  };
}

async function writeReport(report: ApiPerformanceReport) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.info(`Wrote performance report: ${outputPath}`);
}

function parseApiPayload(value: string): ApiPayload | null {
  try {
    return JSON.parse(value) as ApiPayload;
  } catch {
    return null;
  }
}

function endpoint(
  key: string,
  name: string,
  path: string,
): ApiPerformanceEndpoint {
  return { key, name, method: "GET", path };
}

function manualActionSample(durationMs: number): ApiPerformanceSample {
  return {
    status: 200,
    durationMs,
    payloadBytes: 0,
  };
}

function readPositiveInt(name: string, fallback: number) {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readDurationList(name: string) {
  const value = process.env[name];

  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => Number.parseFloat(item.trim()))
    .filter((item) => Number.isFinite(item) && item >= 0)
    .map(roundDuration);
}

function roundDuration(value: number) {
  return Math.round(value * 100) / 100;
}
