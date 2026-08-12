import "server-only";

import { createAdminClient } from "@insforge/sdk";

import { getInsForgeAdminConfig } from "./config";

export function createInsForgeAdminClient() {
  return createAdminClient(getInsForgeAdminConfig());
}
