import { createAuthActions } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

import { validationApiError } from "@/lib/api/errors";
import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { getAppBackend } from "@/lib/backend/selection";
import { getInsForgeConfig } from "@/lib/insforge/config";
import { appError, fail, ok } from "@/lib/insforge/errors";
import { mapVerifiedSupabaseAppUser, type SupabaseAppUserRow } from "@/lib/supabase/auth-mapping";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
      if (getAppBackend() === "supabase") {
        const client = await createSupabaseServerClient();
        const signedIn = await client.auth.signInWithPassword(body);
        if (signedIn.error) return fail(signedIn.error, "Supabase sign in failed.");

        const identity = signedIn.data.user;
        const profile = identity?.email_confirmed_at
          ? await client.from("app_users")
              .select("id, auth_user_id, email, display_name, role, status, credential_ready, owner_app_user_id")
              .eq("auth_user_id", identity.id)
              .maybeSingle()
          : null;
        const mapped = identity?.email_confirmed_at && profile && !profile.error
          ? mapVerifiedSupabaseAppUser({
              identity,
              row: profile.data as SupabaseAppUserRow | null,
            })
          : null;
        if (!mapped?.data) {
          await client.auth.signOut();
          return mapped ?? appError({
            message: "This account is not ready for sign in.",
            code: "APP_ROLE_NOT_CONFIGURED",
            statusCode: 403,
          });
        }
        return ok({ signedIn: true as const });
      }

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
