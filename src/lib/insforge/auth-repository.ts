import "server-only";

import { DEFAULT_ACCESS_TOKEN_COOKIE } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

import type { ApiTimer } from "@/lib/api/timing";
import type { AuthRepository } from "@/lib/auth/repository";
import {
  readJwtSubject,
  readValidatedSessionAndAppUser,
} from "@/lib/auth/session-candidate";
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
  status?: "active" | "disabled";
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
    const accessToken = (await cookies()).get(
      DEFAULT_ACCESS_TOKEN_COOKIE,
    )?.value;
    const candidateAuthUserId = readJwtSubject(accessToken);
    const readSession = async () => {
      const result = timer
        ? await timer.measure("auth.session", () => client.auth.getCurrentUser())
        : await client.auth.getCurrentUser();

      return {
        data: result.data?.user ?? null,
        error: result.error,
      };
    };
    const readRole = async (authUserId: string) => {
      const query = async () =>
        (await client.database
          .from("app_users")
          .select("id, auth_user_id, email, display_name, role, status")
          .eq("auth_user_id", authUserId)
          .limit(1)) as QueryResponse<AppUserRow[]>;

      return timer
        ? timer.measure("auth.app-user.lookup", query)
        : query();
    };
    const resolved = await readValidatedSessionAndAppUser({
      candidateAuthUserId,
      readSession,
      readAppUser: readRole,
    });
    const currentUser = resolved.session;

    if (currentUser.error) {
      return fail(currentUser.error, "Could not resolve current InsForge user");
    }

    const user = currentUser.data;

    if (!user) {
      return ok(null);
    }

    const profile = (user.profile ?? {}) as Record<string, unknown>;
    const roleResult = resolved.appUser;

    if (!roleResult) {
      return fail(
        new Error("Validated session produced no app-user lookup"),
        "Could not resolve app user role",
      );
    }

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

    if (row.status === "disabled") {
      return appError({
        message: "This account has been disabled by an Admin/Landlord.",
        code: "APP_USER_DISABLED",
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
      status: row.status ?? "active",
    });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}
