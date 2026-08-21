export type AuthSourceResult<T> = {
  data: T | null;
  error: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readValidatedSessionAndAppUser<
  TSessionUser extends { id: string },
  TAppUser,
>({
  candidateAuthUserId,
  readSession,
  readAppUser,
}: {
  candidateAuthUserId: string | null;
  readSession: () => Promise<AuthSourceResult<TSessionUser>>;
  readAppUser: (authUserId: string) => Promise<AuthSourceResult<TAppUser>>;
}): Promise<{
  session: AuthSourceResult<TSessionUser>;
  appUser: AuthSourceResult<TAppUser> | null;
}> {
  if (!candidateAuthUserId) {
    const session = await readSession();

    return {
      session,
      appUser: session.data ? await readAppUser(session.data.id) : null,
    };
  }

  const [session, candidateAppUser] = await Promise.all([
    readSession(),
    readAppUser(candidateAuthUserId),
  ]);

  if (!session.data) {
    return { session, appUser: null };
  }

  if (session.data.id === candidateAuthUserId) {
    return { session, appUser: candidateAppUser };
  }

  return {
    session,
    appUser: await readAppUser(session.data.id),
  };
}

export function readJwtSubject(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  try {
    const payloadPart = token.split(".")[1];

    if (!payloadPart) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    ) as { sub?: unknown };

    return typeof payload.sub === "string" && UUID_PATTERN.test(payload.sub)
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}
