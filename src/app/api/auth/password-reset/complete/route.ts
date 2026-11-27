import { createPasswordResetHttpHandlers } from "@/lib/auth/password-reset-http";
import { getAppBackend } from "@/lib/backend/selection";
import { createInsForgePasswordResetRepository } from "@/lib/insforge/password-reset-repository";
import { supabasePasswordResetHandlers } from "@/lib/supabase/password-reset-http";

export const dynamic = "force-dynamic";

const handlers = createPasswordResetHttpHandlers({
  createRepository: createInsForgePasswordResetRepository,
});

export const POST = (request: Request) => getAppBackend() === "supabase"
  ? supabasePasswordResetHandlers.COMPLETE(request)
  : handlers.COMPLETE(request);
