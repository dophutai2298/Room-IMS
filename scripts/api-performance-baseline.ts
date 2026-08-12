type ApiTimingSpan = {
  name: string;
  durationMs: number;
  attributes?: Record<string, string | number | boolean | null>;
};

type ApiTimingSnapshot = {
  requestId: string;
  operation: string;
  totalMs: number;
  spans: ApiTimingSpan[];
};

type ApiPayload = {
  ok?: boolean;
  meta?: {
    timing?: ApiTimingSnapshot;
  };
};

type Endpoint = {
  name: string;
  path: string;
};

type Sample = {
  status: number;
  durationMs: number;
  timing?: ApiTimingSnapshot;
};

const baseUrl = process.env.API_BASELINE_BASE_URL ?? "http://localhost:3000";
const cookie = process.env.API_BASELINE_COOKIE;
const samplesPerEndpoint = readPositiveInt("API_BASELINE_SAMPLES", 5);
const roomId =
  process.env.API_BASELINE_ROOM_ID ??
  "00000000-0000-0000-0000-000000000101";
const tenantId =
  process.env.API_BASELINE_TENANT_ID ??
  "10000000-0000-0000-0000-000000000001";
const month = readPositiveInt("API_BASELINE_MONTH", new Date().getMonth() + 1);
const year = readPositiveInt("API_BASELINE_YEAR", new Date().getFullYear());

const endpoints: Endpoint[] = [
  { name: "Foundation current user", path: "/api/foundation/current-user" },
  { name: "Foundation seeded data", path: "/api/foundation/seeded-data" },
  { name: "Rooms list", path: "/api/rooms" },
  { name: "Room detail", path: `/api/rooms/${roomId}/detail` },
  {
    name: "Room operations summary",
    path: `/api/rooms/${roomId}/operations-summary`,
  },
  { name: "Room tenants", path: `/api/rooms/${roomId}/tenants` },
  { name: "Room contracts", path: `/api/rooms/${roomId}/contracts` },
  {
    name: "Utility Metrics read",
    path: `/api/rooms/${roomId}/utility-metrics?month=${month}&year=${year}`,
  },
  { name: "Invoices list", path: "/api/invoices" },
  {
    name: "Dashboard revenue",
    path: `/api/dashboard/revenue?month=${month}&year=${year}`,
  },
  {
    name: "Dashboard missing Utility Metrics",
    path: `/api/dashboard/missing-utility-metrics?month=${month}&year=${year}`,
  },
  {
    name: "Dashboard unpaid Invoices",
    path: `/api/dashboard/unpaid-invoices?month=${month}&year=${year}`,
  },
  { name: "Tenants directory", path: "/api/tenants" },
  { name: "Tenant detail", path: `/api/tenants/${tenantId}` },
  { name: "Utility Pricing list", path: "/api/utility-pricing" },
  { name: "Staff list", path: "/api/staff" },
];

void main();

async function main() {
  console.info(`API baseline: ${baseUrl}`);
  console.info(
    `Samples: 1 cold + ${samplesPerEndpoint} warm per endpoint; month=${month}; year=${year}`,
  );

  if (!cookie) {
    console.info(
      "API_BASELINE_COOKIE is not set. Protected endpoints may return 401, but timing still reports auth cost.",
    );
  }

  const results: Array<{
    endpoint: Endpoint;
    cold: Sample;
    warm: Sample[];
  }> = [];

  for (const endpoint of endpoints) {
    const cold = await requestEndpoint(endpoint);
    const warm: Sample[] = [];

    for (let index = 0; index < samplesPerEndpoint; index += 1) {
      warm.push(await requestEndpoint(endpoint));
    }

    results.push({ endpoint, cold, warm });
  }

  printResults(results);
}

async function requestEndpoint(endpoint: Endpoint): Promise<Sample> {
  const url = new URL(endpoint.path, baseUrl);
  const startedAt = performance.now();
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  const durationMs = roundDuration(performance.now() - startedAt);
  const payload = (await response.json().catch(() => null)) as ApiPayload | null;

  return {
    status: response.status,
    durationMs,
    timing: payload?.meta?.timing,
  };
}

function printResults(
  results: Array<{
    endpoint: Endpoint;
    cold: Sample;
    warm: Sample[];
  }>,
) {
  const table = results.map(({ endpoint, cold, warm }) => {
    const warmDurations = warm.map((sample) => sample.durationMs).sort(sortNumber);
    const statuses = Array.from(new Set(warm.map((sample) => sample.status))).join(
      ",",
    );
    const largestSpan = findLargestSpan(warm);

    return {
      endpoint: endpoint.name,
      status: statuses || String(cold.status),
      coldMs: cold.durationMs,
      minMs: percentile(warmDurations, 0),
      p50Ms: percentile(warmDurations, 50),
      p95Ms: percentile(warmDurations, 95),
      maxMs: percentile(warmDurations, 100),
      samples: warm.length,
      largestSpan,
    };
  });

  console.table(table);
}

function findLargestSpan(samples: Sample[]) {
  const spans = samples.flatMap((sample) => sample.timing?.spans ?? []);
  const largest = spans.sort((left, right) => right.durationMs - left.durationMs)[0];

  if (!largest) {
    return "n/a";
  }

  return `${largest.name}:${largest.durationMs}ms`;
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

function readPositiveInt(name: string, fallback: number) {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sortNumber(left: number, right: number) {
  return left - right;
}

function roundDuration(value: number) {
  return Math.round(value * 100) / 100;
}
