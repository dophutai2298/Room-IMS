import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminConfig } from "./config";

export function createSupabaseAdminClient() {
  const { url, secretKey } = getSupabaseAdminConfig();

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
