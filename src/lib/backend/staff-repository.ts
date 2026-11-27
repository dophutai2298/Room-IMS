import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { createInsForgeStaffRepository } from "@/lib/insforge/staff-repository";
import { createSupabaseStaffRepository } from "@/lib/supabase/staff-repository";
import { getAppBackend } from "./selection";

export function createStaffRepository({ timer }: { timer?: ApiTimer } = {}) {
  return getAppBackend() === "supabase"
    ? createSupabaseStaffRepository({ timer })
    : createInsForgeStaffRepository({ timer });
}
