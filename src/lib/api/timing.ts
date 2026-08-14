import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type ApiTimingAttribute = string | number | boolean | null;

export type ApiTimingAttributes = Record<string, ApiTimingAttribute>;

export type ApiTimingSpan = {
  name: string;
  durationMs: number;
  attributes?: ApiTimingAttributes;
};

export type ApiTimingSnapshot = {
  requestId?: string;
  operation: string;
  totalMs: number;
  spans: ApiTimingSpan[];
};

export type ApiTimer = {
  readonly requestId: string;
  measure<T>(
    name: string,
    work: () => Promise<T>,
    attributes?: ApiTimingAttributes,
  ): Promise<T>;
  recordSpan(
    name: string,
    durationMs: number,
    attributes?: ApiTimingAttributes,
  ): void;
  snapshot(): ApiTimingSnapshot;
};

const timerStorage = new AsyncLocalStorage<ApiTimer>();

export function createApiTimer(operation: string): ApiTimer {
  const startedAt = now();
  const spans: ApiTimingSpan[] = [];
  const requestId = randomUUID();

  return {
    requestId,

    async measure<T>(
      name: string,
      work: () => Promise<T>,
      attributes?: ApiTimingAttributes,
    ) {
      const spanStartedAt = now();

      try {
        return await work();
      } finally {
        pushSpan(spans, name, now() - spanStartedAt, attributes);
      }
    },

    recordSpan(
      name: string,
      durationMs: number,
      attributes?: ApiTimingAttributes,
    ) {
      pushSpan(spans, name, durationMs, attributes);
    },

    snapshot() {
      return {
        requestId,
        operation,
        totalMs: roundDuration(now() - startedAt),
        spans: [...spans],
      };
    },
  };
}

export function runWithApiTimer<T>(
  timer: ApiTimer,
  work: () => Promise<T>,
): Promise<T> {
  return timerStorage.run(timer, work);
}

export function getActiveApiTimer(): ApiTimer | undefined {
  return timerStorage.getStore();
}

export function logApiTiming(snapshot: ApiTimingSnapshot) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.API_TIMING_LOG_ENABLED !== "true"
  ) {
    return;
  }

  console.info(
    `[api-timing] ${snapshot.operation} requestId=${snapshot.requestId} total=${snapshot.totalMs}ms spans=${snapshot.spans
      .map(formatSpanForLog)
      .join(",")}`,
  );
}

function now() {
  return performance.now();
}

function roundDuration(value: number) {
  return Math.round(value * 100) / 100;
}

function pushSpan(
  spans: ApiTimingSpan[],
  name: string,
  durationMs: number,
  attributes?: ApiTimingAttributes,
) {
  const span: ApiTimingSpan = {
    name,
    durationMs: roundDuration(durationMs),
  };

  if (attributes && Object.keys(attributes).length > 0) {
    span.attributes = { ...attributes };
  }

  spans.push(span);
}

function formatSpanForLog(span: ApiTimingSpan) {
  const attributes = span.attributes
    ? Object.entries(span.attributes)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(";")
    : "";

  return attributes
    ? `${span.name}:${span.durationMs}ms{${attributes}}`
    : `${span.name}:${span.durationMs}ms`;
}
