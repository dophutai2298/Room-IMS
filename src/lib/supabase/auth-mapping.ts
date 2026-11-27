import { appError, ok, type AppResult } from "@/lib/insforge/errors";
import type { AppUser } from "@/lib/insforge/types";

export type SupabaseAppUserRow = {
  id: string;
  auth_user_id: string;
  email: string;
  display_name: string;
  role: "landlord" | "staff";
  status: "active" | "disabled";
  credential_ready: boolean;
  owner_app_user_id: string;
};

export function mapVerifiedSupabaseAppUser({
  identity,
  row,
}: {
  identity: { id: string; email?: string | null };
  row: SupabaseAppUserRow | null;
}): AppResult<AppUser> {
  if (!row || row.auth_user_id !== identity.id ||
      !identity.email || row.email.toLowerCase() !== identity.email.toLowerCase()) {
    return appError({
      message: "Signed-in user has no valid application role.",
      code: "APP_ROLE_NOT_CONFIGURED",
      statusCode: 403,
    });
  }

  if (row.status !== "active") {
    return appError({
      message: "This account has been disabled by an Admin/Landlord.",
      code: "APP_USER_DISABLED",
      statusCode: 403,
    });
  }

  if (!row.credential_ready) {
    return appError({
      message: "Complete email recovery before signing in.",
      code: "APP_CREDENTIAL_SETUP_REQUIRED",
      statusCode: 403,
    });
  }

  if (
    (row.role === "landlord" && row.owner_app_user_id !== row.id) ||
    (row.role === "staff" && row.owner_app_user_id === row.id)
  ) {
    return appError({
      message: "Application owner mapping is invalid.",
      code: "APP_OWNER_INVALID",
      statusCode: 403,
    });
  }

  return ok({
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    ownerAppUserId: row.owner_app_user_id,
  });
}
