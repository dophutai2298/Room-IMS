export type ApiTimingSpan = {
  name: string;
  durationMs: number;
};

export type ApiTimingSnapshot = {
  operation: string;
  totalMs: number;
  spans: ApiTimingSpan[];
};

export type ApiTimer = {
  measure<T>(name: string, work: () => Promise<T>): Promise<T>;
  snapshot(): ApiTimingSnapshot;
};

export function createApiTimer(operation: string): ApiTimer {
  const startedAt = now();
  const spans: ApiTimingSpan[] = [];

  return {
    async measure<T>(name: string, work: () => Promise<T>) {
      const spanStartedAt = now();

      try {
        return await work();
      } finally {
        spans.push({
          name,
          durationMs: roundDuration(now() - spanStartedAt),
        });
      }
    },

    snapshot() {
      return {
        operation,
        totalMs: roundDuration(now() - startedAt),
        spans: [...spans],
      };
    },
  };
}

export function logApiTiming(snapshot: ApiTimingSnapshot) {
  console.info(
    `[api-timing] ${snapshot.operation} total=${snapshot.totalMs}ms spans=${snapshot.spans
      .map((span) => `${span.name}:${span.durationMs}ms`)
      .join(",")}`,
  );
}

function now() {
  return performance.now();
}

function roundDuration(value: number) {
  return Math.round(value * 100) / 100;
}
