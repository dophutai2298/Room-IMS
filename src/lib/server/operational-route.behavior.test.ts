import assert from "node:assert/strict";
import test from "node:test";

import { createApiTimer } from "@/lib/api/timing";
import type { ApiError } from "@/lib/api/errors";
import { getCurrentAppUserForOperations } from "@/lib/auth/service";
import type { AppUser } from "@/lib/insforge/types";
import { resolveOperationalAppUserResult } from "./operational-auth-core";
import { withOperationalAuth } from "./operational-route";

const landlord: AppUser = {
  id: "landlord-app-user",
  authUserId: "landlord-auth-user",
  email: "landlord@example.test",
  displayName: "Landlord Demo",
  role: "landlord",
};

const staff: AppUser = {
  id: "staff-app-user",
  authUserId: "staff-auth-user",
  email: "staff@example.test",
  displayName: "Staff Demo",
  role: "staff",
};

test("operational route resolves Landlord and Staff once and hands the user to the handler", async () => {
  for (const user of [landlord, staff]) {
    let resolveCount = 0;
    let handlerCount = 0;

    const GET = withOperationalAuth(
      {
        operation: `auth.${user.role}.success`,
        allowedRoles: ["landlord", "staff"],
        resolveAuth: async () => {
          resolveCount += 1;
          return { user, error: null };
        },
        logTiming: () => undefined,
      },
      async ({ timer, user: routeUser }) => {
        handlerCount += 1;
        assert.equal(routeUser.id, user.id);

        let duplicateRepositoryLookupCount = 0;
        const nestedAuth = await getCurrentAppUserForOperations({
          timer,
          repository: {
            async getCurrentAppUser() {
              duplicateRepositoryLookupCount += 1;
              return { data: staff, error: null };
            },
          },
        });

        assert.equal(nestedAuth.error, null);
        assert.ok(nestedAuth.data);
        assert.equal(nestedAuth.data.id, user.id);
        assert.equal(duplicateRepositoryLookupCount, 0);

        return { data: { role: routeUser.role }, error: null };
      },
    );

    const response = await GET();
    const body = (await response.json()) as {
      ok: true;
      data: { role: AppUser["role"] };
      meta: { timing: { spans: { name: string }[] } };
    };

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.data.role, user.role);
    assert.equal(resolveCount, 1);
    assert.equal(handlerCount, 1);
    assert.equal(
      body.meta.timing.spans.some((span) => span.name === "auth.cached-app-user"),
      true,
    );
  }
});

test("operational route short-circuits missing auth before calling the handler", async () => {
  let handlerCalled = false;

  const GET = withOperationalAuth(
    {
      operation: "auth.missing",
      resolveAuth: async () => ({
        user: null,
        error: {
          kind: "unauthorized",
          code: "AUTH_REQUIRED",
          message: "Authentication required",
          status: 401,
        },
      }),
      logTiming: () => undefined,
    },
    async () => {
      handlerCalled = true;
      return { data: "unreachable", error: null };
    },
  );

  const response = await GET();
  const body = (await response.json()) as {
    ok: false;
    error: { code: string };
  };

  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "AUTH_REQUIRED");
  assert.equal(handlerCalled, false);
});

test("operational route preserves missing app-user mapping errors", async () => {
  const missingMappingError: ApiError = {
    kind: "forbidden",
    code: "APP_ROLE_NOT_CONFIGURED",
    message: "Signed-in InsForge user has no Landlord or Staff app_user role.",
    status: 403,
  };

  const GET = withOperationalAuth(
    {
      operation: "auth.missing-app-user",
      resolveAuth: async () => ({ user: null, error: missingMappingError }),
      logTiming: () => undefined,
    },
    async () => ({ data: "unreachable", error: null }),
  );

  const response = await GET();
  const body = (await response.json()) as {
    ok: false;
    error: { code: string; message: string };
  };

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "APP_ROLE_NOT_CONFIGURED");
  assert.equal(body.error.message, missingMappingError.message);
});

test("operational route role failures short-circuit protected handlers", async () => {
  let handlerCalled = false;

  const POST = withOperationalAuth(
    {
      operation: "auth.role-forbidden",
      allowedRoles: ["landlord"],
      resolveAuth: async () => ({ user: staff, error: null }),
      logTiming: () => undefined,
    },
    async () => {
      handlerCalled = true;
      return { data: "unreachable", error: null };
    },
  );

  const response = await POST();
  const body = (await response.json()) as {
    ok: false;
    error: { code: string };
  };

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "FORBIDDEN");
  assert.equal(handlerCalled, false);
});

test("operational route still converts handler exceptions to the standard error response", async () => {
  const GET = withOperationalAuth(
    {
      operation: "auth.handler-exception",
      resolveAuth: async () => ({ user: landlord, error: null }),
      logTiming: () => undefined,
    },
    async () => {
      throw new Error("Repository exploded");
    },
  );

  const response = await GET();
  const body = (await response.json()) as {
    ok: false;
    error: { code: string; message: string };
  };

  assert.equal(response.status, 500);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "Error");
  assert.equal(body.error.message, "Repository exploded");
});

test("operational auth keeps the total auth span for timing compatibility", async () => {
  const timer = createApiTimer("auth.compatibility");

  const result = await resolveOperationalAppUserResult({
    timer,
    getCurrentUser: async () => ({ data: landlord, error: null }),
  });
  const spans = timer.snapshot().spans;

  assert.equal(result.error, null);
  assert.equal(spans.some((span) => span.name === "auth"), true);
});
