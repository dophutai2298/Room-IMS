import "server-only";

import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

import { getActiveApiTimer, type ApiTimer } from "@/lib/api/timing";
import { getInsForgeConfig } from "./config";
import { createTracedInsForgeFetch } from "./tracing";

export async function createInsForgeServerClient({
  timer = getActiveApiTimer(),
}: {
  timer?: ApiTimer;
} = {}) {
  const config = getInsForgeConfig();

  const buildClient = async () =>
    createServerClient({
      ...config,
      fetch: createTracedInsForgeFetch({ timer }),
      cookies: await cookies(),
    });

  return timer
    ? timer.measure("insforge.client-init", buildClient)
    : buildClient();
}
