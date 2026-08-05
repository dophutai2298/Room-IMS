import { apiFailure, apiSuccess } from "@/lib/api/response";
import { createApiTimer } from "@/lib/api/timing";
import { resolveOperationalAppUser } from "@/lib/server/operational-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const timer = createApiTimer("foundation.current-user");
  const auth = await resolveOperationalAppUser({ timer });
  const meta = { timing: timer.snapshot() };

  if (auth.error) {
    return apiFailure(auth.error, meta);
  }

  return apiSuccess(auth.user, meta);
}
