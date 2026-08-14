import "server-only";

import { createAdminClient } from "@insforge/sdk";

import { getActiveApiTimer, type ApiTimer } from "@/lib/api/timing";
import { getInsForgeAdminConfig } from "./config";
import { createTracedInsForgeFetch } from "./tracing";

export function createInsForgeAdminClient({
  timer = getActiveApiTimer(),
}: {
  timer?: ApiTimer;
} = {}) {
  const config = getInsForgeAdminConfig();

  const buildClient = () =>
    createAdminClient({
      ...config,
      fetch: createTracedInsForgeFetch({ timer }),
    });

  if (!timer) {
    return buildClient();
  }

  const startedAt = performance.now();
  const client = buildClient();
  timer.recordSpan("insforge.client-init", performance.now() - startedAt);

  return client;
}
