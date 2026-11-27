import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { createInsForgeRoomRepository } from "@/lib/insforge/room-repository";
import { createSupabaseRoomRepository } from "@/lib/supabase/room-repository";
import { getAppBackend } from "./selection";

export function createRoomRepository({ timer }: { timer?: ApiTimer } = {}) {
  return getAppBackend() === "supabase"
    ? createSupabaseRoomRepository({ timer })
    : createInsForgeRoomRepository({ timer });
}
