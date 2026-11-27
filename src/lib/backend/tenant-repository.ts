import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { createInsForgeTenantRepository } from "@/lib/insforge/tenant-repository";
import { createSupabaseTenantRepository } from "@/lib/supabase/tenant-repository";
import { getAppBackend } from "./selection";

export function createTenantRepository({ timer }: { timer?: ApiTimer } = {}) {
  return getAppBackend() === "supabase"
    ? createSupabaseTenantRepository({ timer })
    : createInsForgeTenantRepository({ timer });
}
