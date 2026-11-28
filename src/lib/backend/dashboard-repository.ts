import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { createInsForgeDashboardRepository } from "@/lib/insforge/dashboard-repository";
import { createSupabaseBillingClient } from "@/lib/supabase/billing-client";
import { getAppBackend } from "./selection";

export function createDashboardRepository({ timer }: { timer?: ApiTimer } = {}) {
  return createInsForgeDashboardRepository({
    timer,
    ...(getAppBackend() === "supabase" ? { clientFactory: createSupabaseBillingClient } : {}),
  });
}
