"use client";

import { createBrowserClient } from "@insforge/sdk/ssr";

import { getInsForgeConfig } from "./config";

export function createInsForgeBrowserClient() {
  return createBrowserClient({
    ...getInsForgeConfig(),
    refreshUrl: "/api/auth/refresh",
  });
}
