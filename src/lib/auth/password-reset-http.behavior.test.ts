import assert from "node:assert/strict";
import test from "node:test";

import type {
  PasswordResetAccount,
  PasswordResetRepository,
} from "./password-reset-repository";
import { createPasswordResetHttpHandlers } from "./password-reset-http";

test("password reset HTTP request returns neutral success shape", async () => {
  const repository = createFakePasswordResetRepository(null);
  const handlers = createPasswordResetHttpHandlers({
    createRepository: () => repository,
    logTiming: () => undefined,
    now: () => new Date("2026-08-18T10:00:00.000Z"),
  });

  const response = await handlers.REQUEST(
    new Request("http://localhost/api/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email: "missing@example.test" }),
    }),
  );
  const body = (await response.json()) as {
    ok: true;
    data: { requested: boolean; email: string };
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.requested, true);
  assert.equal(body.data.email, "missing@example.test");
});

test("password reset HTTP exchange rejects disabled Staff", async () => {
  const repository = createFakePasswordResetRepository({
    email: "staff@example.test",
    status: "disabled",
  });
  const handlers = createPasswordResetHttpHandlers({
    createRepository: () => repository,
    logTiming: () => undefined,
  });

  const response = await handlers.EXCHANGE(
    new Request("http://localhost/api/auth/password-reset/exchange", {
      method: "POST",
      body: JSON.stringify({ email: "staff@example.test", code: "123456" }),
    }),
  );
  const body = (await response.json()) as {
    ok: false;
    error: { code: string };
  };

  assert.equal(response.status, 403);
  assert.equal(body.error.code, "PASSWORD_RESET_ACCOUNT_DISABLED");
});

function createFakePasswordResetRepository(
  account: PasswordResetAccount | null,
): PasswordResetRepository {
  return {
    async sendResetPasswordEmail() {
      return { data: { requested: true }, error: null };
    },
    async readPasswordResetAccount({ email }) {
      return {
        data: account && account.email === email ? account : null,
        error: null,
      };
    },
    async exchangeResetPasswordToken() {
      return {
        data: {
          token: "reset-token",
          expiresAt: "2026-08-18T10:10:00.000Z",
        },
        error: null,
      };
    },
    async resetPassword() {
      return { data: { reset: true }, error: null };
    },
  };
}
