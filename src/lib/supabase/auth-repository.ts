import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import type { AuthRepository } from "@/lib/auth/repository";
import { appError, fail, ok, type AppResult, toAppBackendError } from "@/lib/insforge/errors";
import type { AppUser } from "@/lib/insforge/types";
import { mapVerifiedSupabaseAppUser, type SupabaseAppUserRow } from "./auth-mapping";
import { createSupabaseServerClient } from "./server";

export function createSupabaseAuthRepository({
  timer,
}: { timer?: ApiTimer } = {}): AuthRepository {
  return {
    getCurrentAppUser() {
      const work = () => readCurrentAppUser({ timer });
      return timer ? timer.measure("repository.supabase.current-user", work) : work();
    },
  };
}

async function readCurrentAppUser({
  timer,
}: { timer?: ApiTimer }): Promise<AppResult<AppUser | null>> {
  try {
    const client = await createSupabaseServerClient();
    const verified = timer
      ? await timer.measure("auth.session", () => client.auth.getUser())
      : await client.auth.getUser();

    if (verified.error || !verified.data.user) {
      return ok(null);
    }

    if (!verified.data.user.email_confirmed_at) {
      return appError({
        message: "Email verification required.",
        code: "EMAIL_VERIFICATION_REQUIRED",
        statusCode: 403,
      });
    }

    const lookup = async () =>
      client.from("app_users")
        .select("id, auth_user_id, email, display_name, role, status, credential_ready, owner_app_user_id")
        .eq("auth_user_id", verified.data.user!.id)
        .maybeSingle();
    const profile = timer
      ? await timer.measure("auth.app-user.lookup", lookup)
      : await lookup();

    if (profile.error) return fail(profile.error, "Could not resolve application role");

    return mapVerifiedSupabaseAppUser({
      identity: verified.data.user,
      row: profile.data as SupabaseAppUserRow | null,
    });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}
