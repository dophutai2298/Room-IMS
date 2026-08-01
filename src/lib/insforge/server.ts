import "server-only";

import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

import { getInsForgeConfig } from "./config";

export async function createInsForgeServerClient() {
  const config = getInsForgeConfig();

  return createServerClient({
    ...config,
    cookies: await cookies(),
  });
}
