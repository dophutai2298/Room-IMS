import { createAuthActions } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

import { validationApiError } from "@/lib/api/errors";
import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { getInsForgeConfig } from "@/lib/insforge/config";
import { fail, ok } from "@/lib/insforge/errors";

export async function POST(request: Request) {
  const timer = createApiTimer("auth.sign-in");

  try {
    const body = await timer.measure("validation", () =>
      readSignInRequest(request),
    );

    if (!body) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(
        validationApiError({ message: "Email and password are required." }),
        meta,
      );
    }

    const result = await timer.measure("auth", async () => {
      const auth = createAuthActions({
        ...getInsForgeConfig(),
        cookies: await cookies(),
      });
      const signInResult = await auth.signInWithPassword(body);

      return signInResult.error
        ? fail(signInResult.error, "InsForge sign in failed.")
        : ok({ signedIn: true as const });
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

async function readSignInRequest(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  return email && password ? { email, password } : null;
}
