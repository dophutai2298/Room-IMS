import { appError, fail, ok, type AppResult } from "@/lib/insforge/errors";

export async function provisionSupabaseStaff<T>({
  createAuth,
  deleteAuth,
  insertProfile,
}: {
  email: string;
  createAuth: () => Promise<{ data: { id: string } | null; error: unknown }>;
  insertProfile: (authUserId: string) => Promise<{ data: T | null; error: unknown }>;
  deleteAuth: (authUserId: string) => Promise<{ error: unknown }>;
}): Promise<AppResult<T>> {
  const created = await createAuth();
  if (created.error) return fail(created.error, "Could not create Staff Auth identity");
  if (!created.data?.id) {
    return appError({
      message: "Supabase created no Staff Auth identity.",
      code: "STAFF_AUTH_USER_MISSING",
      statusCode: 502,
    });
  }

  let profile: { data: T | null; error: unknown };
  try {
    profile = await insertProfile(created.data.id);
  } catch (error) {
    profile = { data: null, error };
  }
  if (!profile.error && profile.data) return ok(profile.data);

  let compensationError: unknown;
  try {
    compensationError = (await deleteAuth(created.data.id)).error;
  } catch (error) {
    compensationError = error;
  }
  if (compensationError) {
    return appError({
      message: "Staff Auth identity needs manual reconciliation before retry.",
      code: "STAFF_AUTH_RECONCILIATION_REQUIRED",
      statusCode: 502,
    });
  }

  return profile.error
    ? fail(profile.error, "Could not map Staff application role")
    : appError({
        message: "Staff application role mapping returned no row.",
        code: "STAFF_ROLE_MAPPING_MISSING",
        statusCode: 502,
      });
}
