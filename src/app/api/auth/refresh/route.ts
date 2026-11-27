import { createRefreshAuthRouter } from "@insforge/sdk/ssr";

import { getAppBackend } from "@/lib/backend/selection";
import { getInsForgeConfig } from "@/lib/insforge/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (getAppBackend() === "supabase") {
    const client = await createSupabaseServerClient();
    const result = await client.auth.refreshSession();
    return Response.json({ ok: !result.error }, { status: result.error ? 401 : 200 });
  }

  const router = createRefreshAuthRouter(getInsForgeConfig());

  return router.POST(request);
}
