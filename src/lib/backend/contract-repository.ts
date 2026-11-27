import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { createInsForgeContractRepository } from "@/lib/insforge/contract-repository";
import { createSupabaseContractRepository } from "@/lib/supabase/contract-repository";
import { getAppBackend } from "./selection";

export function createContractRepository({ timer }: { timer?: ApiTimer } = {}) {
  return getAppBackend() === "supabase"
    ? createSupabaseContractRepository({ timer })
    : createInsForgeContractRepository({ timer });
}
