import { createAuthActions } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

import { apiException, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { getInsForgeConfig } from "@/lib/insforge/config";
import { fail, ok } from "@/lib/insforge/errors";

export async function POST() {
  const timer = createApiTimer("auth.sign-out");

  try {
    const result = await timer.measure("auth", async () => {
      const auth = createAuthActions({
        ...getInsForgeConfig(),
        cookies: await cookies(),
      });
      const signOutResult = await auth.signOut();

      return signOutResult.error
        ? fail(signOutResult.error, "Could not sign out")
        : ok({ signedOut: true as const });
    });
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);

    return apiResult(result, meta);
  } catch (error) {
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);

    return apiException(error, meta);
  }
}
