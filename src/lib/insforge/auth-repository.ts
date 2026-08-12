import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import type { AuthRepository } from "@/lib/auth/repository";
import type { AppUser } from "./types";
import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";

type QueryResponse<T> = {
  data: T | null;
  error: unknown;
};

type AppUserRow = {
  id: string;
  auth_user_id: string;
  email: string;
  display_name: string;
  role: "landlord" | "staff";
};

export function createInsForgeAuthRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): AuthRepository {
  return {
    async getCurrentAppUser() {
      const query = () => readCurrentAppUserFromInsForge({ timer });

      return timer
        ? timer.measure("repository.insforge.current-user", query)
        : query();
    },
  };
}

async function readCurrentAppUserFromInsForge({
  timer,
}: {
  timer?: ApiTimer;
} = {}): Promise<AppResult<AppUser | null>> {
  try {
    const client = await createInsForgeServerClient({ timer });
    const currentUser = timer
      ? await timer.measure("auth.session", () => client.auth.getCurrentUser())
      : await client.auth.getCurrentUser();

    if (currentUser.error) {
      return fail(currentUser.error, "Could not resolve current InsForge user");
    }

    const user = currentUser.data?.user;

    if (!user) {
      return ok(null);
    }

    const profile = (user.profile ?? {}) as Record<string, unknown>;
    const readRole = async () =>
      (await client.database
        .from("app_users")
        .select("id, auth_user_id, email, display_name, role")
        .eq("auth_user_id", user.id)
        .limit(1)) as QueryResponse<AppUserRow[]>;
    const roleResult = timer
      ? await timer.measure("auth.app-user.lookup", readRole)
      : await readRole();

    if (roleResult.error) {
      return fail(roleResult.error, "Could not resolve app user role");
    }

    const row = roleResult.data?.[0];

    if (!row) {
      return appError({
        message: "Signed-in InsForge user has no Landlord or Staff app_user role.",
        code: "APP_ROLE_NOT_CONFIGURED",
        statusCode: 403,
      });
    }

    return ok({
      id: row.id,
      authUserId: row.auth_user_id,
      email: row.email || user.email,
      displayName:
        row.display_name ||
        String(profile.displayName ?? profile.nickname ?? user.email),
      role: row.role,
    });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}
