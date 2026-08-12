import assert from "node:assert/strict";
import test from "node:test";

import type { AppUser } from "@/lib/insforge/types";
import { resolveCreatedStaffAuthUserId } from "@/lib/insforge/staff-auth-user";
import {
  createStaffForOperations,
  listStaffForOperations,
} from "@/lib/staff/service";
import type { StaffRepository } from "@/lib/staff/repository";
import { createStaffHttpHandlers } from "@/lib/staff/http";
import {
  requireOperationalRole,
  resolveOperationalAppUserResult,
} from "@/lib/server/operational-auth-core";

const landlord: AppUser = {
  id: "landlord-app-user",
  authUserId: "landlord-auth-user",
  email: "landlord@example.test",
  displayName: "Landlord Demo",
  role: "landlord",
};

const staffUser: AppUser = {
  id: "staff-app-user",
  authUserId: "staff-auth-user",
  email: "staff@example.test",
  displayName: "Staff Demo",
  role: "staff",
};

test("operational auth allows signed-in Landlord and Staff", async () => {
  for (const user of [landlord, staffUser]) {
    const auth = await resolveOperationalAppUserResult({
      getCurrentUser: async () => ({ data: user, error: null }),
    });

    assert.equal(auth.error, null);
    assert.equal(auth.user.role, user.role);
  }
});

test("operational auth rejects unauthenticated users with the standard 401", async () => {
  const auth = await resolveOperationalAppUserResult({
    getCurrentUser: async () => ({ data: null, error: null }),
  });

  assert.equal(auth.user, null);
  assert.equal(auth.error.status, 401);
  assert.equal(auth.error.code, "AUTH_REQUIRED");
});

test("Landlord-only Staff management rejects an authenticated Staff user with 403", () => {
  assert.equal(requireOperationalRole(landlord, ["landlord"]), null);

  const error = requireOperationalRole(staffUser, ["landlord"]);
  assert.equal(error?.status, 403);
  assert.equal(error?.code, "FORBIDDEN");
});

test("Staff service lists Staff and provisions a normalized account", async () => {
  const repository = createFakeStaffRepository();
  const listed = await listStaffForOperations({ repository });
  const created = await createStaffForOperations({
    repository,
    displayName: "  Nguyen Van An  ",
    email: "  STAFF@EXAMPLE.TEST ",
    password: "StrongPass123!",
  });

  assert.equal(listed.error, null);
  assert.equal(listed.data.length, 1);
  assert.equal(created.error, null);
  assert.equal(created.data.displayName, "Nguyen Van An");
  assert.equal(created.data.email, "staff@example.test");
});

test("Staff service validates fields before provisioning an account", async () => {
  const repository = createFakeStaffRepository();
  const result = await createStaffForOperations({
    repository,
    displayName: "A",
    email: "not-an-email",
    password: "short",
  });

  assert.equal(result.data, null);
  assert.equal(result.error.code, "STAFF_INPUT_INVALID");
});

test("Staff provisioning resolves an auth user when InsForge signUp omits the user payload", async () => {
  const authUserId = await resolveCreatedStaffAuthUserId({
    email: "staff@example.test",
    signUpData: {
      accessToken: null,
      requireEmailVerification: false,
    },
    authClient: {
      getHttpClient() {
        return {
          async get<T>(path: string, options?: { params?: Record<string, string> }) {
            assert.equal(path, "/api/auth/users");
            assert.equal(options?.params?.search, "staff@example.test");

            return {
              data: [
                {
                  id: "staff-auth-user-from-list",
                  email: "staff@example.test",
                },
              ],
            } as T;
          },
        };
      },
    },
  });

  assert.equal(authUserId.error, null);
  assert.equal(authUserId.data, "staff-auth-user-from-list");
});

test("Staff HTTP boundary returns standard 200, 401, and 403 responses", async () => {
  const repository = createFakeStaffRepository();
  const createHandlers = (user: AppUser | null) =>
    createStaffHttpHandlers({
      resolveAuth: async () =>
        user
          ? { user, error: null }
          : {
              user: null,
              error: {
                kind: "unauthorized",
                code: "AUTH_REQUIRED",
                message: "Authentication required",
                status: 401,
              },
            },
      createRepository: () => repository,
      logTiming: () => undefined,
    });

  const landlordResponse = await createHandlers(landlord).GET();
  const staffResponse = await createHandlers(staffUser).GET();
  const unauthenticatedResponse = await createHandlers(null).POST(
    new Request("http://localhost/api/staff", {
      method: "POST",
      body: "not-json",
    }),
  );
  const unauthorizedBody = (await unauthenticatedResponse.json()) as {
    ok: false;
    error: { code: string };
  };

  assert.equal(landlordResponse.status, 200);
  assert.equal(staffResponse.status, 403);
  assert.equal(unauthenticatedResponse.status, 401);
  assert.equal(unauthorizedBody.ok, false);
  assert.equal(unauthorizedBody.error.code, "AUTH_REQUIRED");
});

function createFakeStaffRepository(): StaffRepository {
  return {
    async listStaff() {
      return {
        data: [
          {
            id: "staff-app-user",
            authUserId: "staff-auth-user",
            email: "existing@example.test",
            displayName: "Existing Staff",
            createdAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-08-01T00:00:00.000Z",
          },
        ],
        error: null,
      };
    },
    async createStaff(input) {
      return {
        data: {
          id: "new-staff-app-user",
          authUserId: "new-staff-auth-user",
          email: input.email,
          displayName: input.displayName,
          createdAt: "2026-08-12T00:00:00.000Z",
          updatedAt: "2026-08-12T00:00:00.000Z",
        },
        error: null,
      };
    },
  };
}
