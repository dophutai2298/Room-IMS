import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import type { StaffListItem } from "@/lib/staff/presenter";
import type {
  CreateStaffInput,
  StaffRepository,
} from "@/lib/staff/repository";
import { createInsForgeAdminClient } from "./admin";
import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import { resolveCreatedStaffAuthUserId } from "./staff-auth-user";

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
  created_at: string;
  updated_at: string;
};

export function createInsForgeStaffRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): StaffRepository {
  return {
    async listStaff() {
      const query = () => readStaffFromInsForge({ timer });

      return timer
        ? timer.measure("repository.insforge.staff-list", query)
        : query();
    },
    async createStaff(input) {
      const query = () => createStaffInInsForge({ ...input, timer });

      return timer
        ? timer.measure("repository.insforge.staff-create", query)
        : query();
    },
  };
}

async function readStaffFromInsForge({
  timer,
}: {
  timer?: ApiTimer;
} = {}): Promise<AppResult<StaffListItem[]>> {
  try {
    const client = await createInsForgeServerClient({ timer });
    const response = (await client.database
      .from("app_users")
      .select(staffSelect)
      .eq("role", "staff")
      .order("display_name")) as QueryResponse<AppUserRow[]>;

    if (response.error) {
      return fail(response.error, "Could not read Staff accounts");
    }

    return ok((response.data ?? []).map(toStaffListItem));
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function createStaffInInsForge({
  timer,
  ...input
}: CreateStaffInput & {
  timer?: ApiTimer;
}): Promise<AppResult<StaffListItem>> {
  try {
    const authClient = createInsForgeAdminClient({ timer });
    const authResult = await authClient.auth.signUp({
      email: input.email,
      password: input.password,
      name: input.displayName,
      autoConfirm: true,
    });

    const authUserIdResult = authResult.error
      ? await resolveCreatedStaffAuthUserId({
          authClient,
          email: input.email,
          signUpData: null,
        })
      : await resolveCreatedStaffAuthUserId({
          authClient,
          email: input.email,
          signUpData: authResult.data,
        });

    if (authResult.error && authUserIdResult.error) {
      return fail(authResult.error, "Could not create InsForge Staff account");
    }

    if (authUserIdResult.error) {
      return authUserIdResult;
    }

    // signUp may return a user session. A fresh admin client ensures the
    // following role mapping still runs with the project admin credential.
    const databaseClient = createInsForgeAdminClient({ timer });
    const existingStaffResult = await readExistingStaffProfile({
      authUserId: authUserIdResult.data,
      databaseClient,
      email: input.email,
    });

    if (existingStaffResult.error) {
      return existingStaffResult;
    }

    if (existingStaffResult.data) {
      return ok(toStaffListItem(existingStaffResult.data));
    }

    const now = new Date().toISOString();
    const profileResult = (await databaseClient.database
      .from("app_users")
      .insert({
        auth_user_id: authUserIdResult.data,
        email: input.email,
        display_name: input.displayName,
        role: "staff",
        updated_at: now,
      })
      .select(staffSelect)
      .limit(1)) as QueryResponse<AppUserRow[]>;

    if (profileResult.error) {
      return fail(profileResult.error, "Could not map Staff app role");
    }

    const row = profileResult.data?.[0];

    if (!row) {
      return appError({
        message: "Staff account role mapping returned no row.",
        code: "STAFF_ROLE_MAPPING_MISSING",
        statusCode: 502,
      });
    }

    return ok(toStaffListItem(row));
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readExistingStaffProfile({
  authUserId,
  databaseClient,
  email,
}: {
  authUserId: string;
  databaseClient: ReturnType<typeof createInsForgeAdminClient>;
  email: string;
}): Promise<AppResult<AppUserRow | null>> {
  const byAuthUserId = (await databaseClient.database
    .from("app_users")
    .select(staffSelect)
    .eq("auth_user_id", authUserId)
    .eq("role", "staff")
    .limit(1)) as QueryResponse<AppUserRow[]>;

  if (byAuthUserId.error) {
    return fail(byAuthUserId.error, "Could not read existing Staff app role");
  }

  const authUserRow = byAuthUserId.data?.[0];

  if (authUserRow) {
    return ok(authUserRow);
  }

  const byEmail = (await databaseClient.database
    .from("app_users")
    .select(staffSelect)
    .eq("email", email)
    .eq("role", "staff")
    .limit(1)) as QueryResponse<AppUserRow[]>;

  if (byEmail.error) {
    return fail(byEmail.error, "Could not read existing Staff app role");
  }

  return ok(byEmail.data?.[0] ?? null);
}

function toStaffListItem(row: AppUserRow): StaffListItem {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const staffSelect = [
  "id",
  "auth_user_id",
  "email",
  "display_name",
  "role",
  "created_at",
  "updated_at",
].join(", ");
