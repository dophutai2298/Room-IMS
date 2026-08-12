import { appError, fail, ok, type AppResult } from "./errors";

type StaffAuthUser = {
  id: string;
  email: string;
};

export type StaffAuthLookupClient = {
  getHttpClient(): {
    get<T>(path: string, options?: { params?: Record<string, string> }): Promise<T>;
  };
};

type StaffAuthUsersResponse = {
  data?: StaffAuthUser[];
};

export async function resolveCreatedStaffAuthUserId({
  authClient,
  email,
  signUpData,
}: {
  authClient: StaffAuthLookupClient;
  email: string;
  signUpData: unknown;
}): Promise<AppResult<string>> {
  const authUser = readStaffAuthUserFromSignUpData(signUpData);

  if (authUser) {
    return ok(authUser.id);
  }

  const lookupResult = await findStaffAuthUserByEmail(authClient, email);

  if (lookupResult.error) {
    return lookupResult;
  }

  const fallbackAuthUser = lookupResult.data;

  if (!fallbackAuthUser) {
    return appError({
      message: "InsForge created no Staff auth user.",
      code: "STAFF_AUTH_USER_MISSING",
      statusCode: 502,
    });
  }

  return ok(fallbackAuthUser.id);
}

async function findStaffAuthUserByEmail(
  authClient: StaffAuthLookupClient,
  email: string,
): Promise<AppResult<StaffAuthUser | null>> {
  try {
    const response = await authClient.getHttpClient().get<StaffAuthUsersResponse>(
      "/api/auth/users",
      {
        params: {
          search: email,
        },
      },
    );
    const normalizedEmail = email.toLowerCase();
    const authUser =
      response.data?.find((user) => user.email.toLowerCase() === normalizedEmail) ??
      null;

    return ok(authUser);
  } catch (error) {
    return fail(error, "Could not find created InsForge Staff account");
  }
}

function readStaffAuthUserFromSignUpData(signUpData: unknown): StaffAuthUser | null {
  if (
    typeof signUpData !== "object" ||
    signUpData === null ||
    !("user" in signUpData)
  ) {
    return null;
  }

  const user = (signUpData as { user?: unknown }).user;

  if (typeof user !== "object" || user === null || !("id" in user)) {
    return null;
  }

  const id = (user as { id?: unknown }).id;
  const email = (user as { email?: unknown }).email;

  if (typeof id !== "string" || typeof email !== "string") {
    return null;
  }

  return { id, email };
}
