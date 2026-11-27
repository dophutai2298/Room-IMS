import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { appError, fail, ok, type AppResult, toAppBackendError } from "@/lib/insforge/errors";
import { getActiveOwnerAppUserId } from "@/lib/server/operational-owner-scope";
import type { StaffListItem } from "@/lib/staff/presenter";
import type { StaffRepository } from "@/lib/staff/repository";
import { createSupabaseAdminClient } from "./admin";
import { createSupabaseServerClient } from "./server";
import { provisionSupabaseStaff } from "./staff-provisioning";

type StaffRow = {
  id: string;
  auth_user_id: string;
  email: string;
  display_name: string;
  role: "staff";
  status: "active" | "disabled";
  owner_app_user_id: string;
  created_at: string;
  updated_at: string;
};

const staffColumns = "id, auth_user_id, email, display_name, role, status, owner_app_user_id, created_at, updated_at";

export function createSupabaseStaffRepository({
  timer,
}: { timer?: ApiTimer } = {}): StaffRepository {
  const measure = <T>(name: string, work: () => Promise<AppResult<T>>) =>
    timer ? timer.measure(name, work) : work();

  return {
    listStaff() {
      return measure("repository.supabase.staff-list", async () => {
        try {
          const db = await createSupabaseServerClient();
          const result = await db.from("app_users").select(staffColumns)
            .eq("role", "staff")
            .eq("owner_app_user_id", getActiveOwnerAppUserId())
            .order("display_name");
          if (result.error) return fail(result.error, "Could not read Staff accounts");
          return ok(((result.data ?? []) as StaffRow[]).map(toStaffListItem));
        } catch (error) { return { data: null, error: toAppBackendError(error) }; }
      });
    },
    createStaff(input) {
      return measure("repository.supabase.staff-create", async () => {
        try {
          const ownerAppUserId = getActiveOwnerAppUserId();
          const admin = createSupabaseAdminClient();
          const existing = await admin.from("app_users").select("id")
            .eq("email", input.email).maybeSingle();
          if (existing.error) return fail(existing.error, "Could not check Staff email");
          if (existing.data) {
            return appError({
              message: "This email already belongs to an application account.",
              code: "STAFF_EMAIL_EXISTS",
              statusCode: 409,
            });
          }

          const provisioned = await provisionSupabaseStaff({
            email: input.email,
            createAuth: async () => {
              const response = await admin.auth.admin.createUser({
                email: input.email,
                password: input.password,
                email_confirm: false,
                user_metadata: { display_name: input.displayName },
              });
              return { data: response.data.user, error: response.error };
            },
            insertProfile: async (authUserId) => {
              const response = await admin.from("app_users").insert({
                auth_user_id: authUserId,
                email: input.email,
                display_name: input.displayName,
                role: "staff",
                credential_ready: false,
                owner_app_user_id: ownerAppUserId,
              }).select(staffColumns).single();
              return { data: response.data as StaffRow | null, error: response.error };
            },
            deleteAuth: async (authUserId) => {
              const response = await admin.auth.admin.deleteUser(authUserId);
              return { error: response.error };
            },
          });
          return provisioned.error
            ? provisioned
            : ok(toStaffListItem(provisioned.data));
        } catch (error) { return { data: null, error: toAppBackendError(error) }; }
      });
    },
    updateStaff({ staffId, displayName }) {
      return measure("repository.supabase.staff-update", async () => {
        try {
          const db = await createSupabaseServerClient();
          const response = await db.from("app_users").update({
            display_name: displayName,
            updated_at: new Date().toISOString(),
          }).eq("id", staffId).eq("role", "staff")
            .eq("owner_app_user_id", getActiveOwnerAppUserId())
            .select(staffColumns).maybeSingle();
          if (response.error) return fail(response.error, "Could not update Staff account");
          return response.data
            ? ok(toStaffListItem(response.data as StaffRow))
            : staffNotFound();
        } catch (error) { return { data: null, error: toAppBackendError(error) }; }
      });
    },
    deleteStaff({ staffId }) {
      return measure("repository.supabase.staff-delete", async () => {
        try {
          const db = await createSupabaseServerClient();
          const response = await db.from("app_users").update({
            status: "disabled",
            updated_at: new Date().toISOString(),
          }).eq("id", staffId).eq("role", "staff")
            .eq("owner_app_user_id", getActiveOwnerAppUserId())
            .select(staffColumns).maybeSingle();
          if (response.error) return fail(response.error, "Could not disable Staff account");
          return response.data
            ? ok(toStaffListItem(response.data as StaffRow))
            : staffNotFound();
        } catch (error) { return { data: null, error: toAppBackendError(error) }; }
      });
    },
  };
}

function toStaffListItem(row: StaffRow): StaffListItem {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function staffNotFound() {
  return appError({ message: "Staff account was not found.", code: "STAFF_NOT_FOUND", statusCode: 404 });
}
