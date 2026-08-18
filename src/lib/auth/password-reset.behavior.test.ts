import assert from "node:assert/strict";
import test from "node:test";

import {
  completePasswordResetForOperations,
  exchangePasswordResetCodeForOperations,
  requestPasswordResetForOperations,
} from "./password-reset-service";
import type {
  PasswordResetAccount,
  PasswordResetRepository,
} from "./password-reset-repository";

test("password reset request is neutral and normalizes the email", async () => {
  const repository = createFakePasswordResetRepository();
  const result = await requestPasswordResetForOperations({
    repository,
    email: " STAFF.REQUEST@EXAMPLE.TEST ",
    now: new Date("2026-08-18T10:00:00.000Z"),
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    requested: true,
    email: "staff.request@example.test",
    resendAvailableAt: "2026-08-18T10:01:00.000Z",
  });
  assert.deepEqual(repository.sentResetEmails, ["staff.request@example.test"]);
  assert.deepEqual(repository.readAccounts, []);
});

test("password reset request rate-limits repeated emails without checking account existence", async () => {
  const repository = createFakePasswordResetRepository();
  const first = await requestPasswordResetForOperations({
    repository,
    email: "rate-limit@example.test",
    now: new Date("2026-08-18T10:00:00.000Z"),
  });
  const second = await requestPasswordResetForOperations({
    repository,
    email: "rate-limit@example.test",
    now: new Date("2026-08-18T10:00:30.000Z"),
  });

  assert.equal(first.error, null);
  assert.equal(second.data, null);
  assert.equal(second.error.code, "PASSWORD_RESET_RATE_LIMITED");
  assert.equal(second.error.statusCode, 429);
  assert.deepEqual(repository.sentResetEmails, ["rate-limit@example.test"]);
  assert.deepEqual(repository.readAccounts, []);
});

test("password reset exchanges OTP for active accounts and blocks disabled Staff", async () => {
  const activeRepository = createFakePasswordResetRepository({
    account: { email: "staff.exchange@example.test", status: "active" },
    providerTokenExpiresAt: "2026-08-18T10:30:00.000Z",
  });
  const disabledRepository = createFakePasswordResetRepository({
    account: { email: "disabled.exchange@example.test", status: "disabled" },
  });
  const active = await exchangePasswordResetCodeForOperations({
    repository: activeRepository,
    email: "staff.exchange@example.test",
    code: "123456",
    now: new Date("2026-08-18T10:00:00.000Z"),
  });
  const disabled = await exchangePasswordResetCodeForOperations({
    repository: disabledRepository,
    email: "disabled.exchange@example.test",
    code: "123456",
    now: new Date("2026-08-18T10:00:00.000Z"),
  });

  assert.equal(active.error, null);
  assert.deepEqual(active.data, {
    token: "reset-token-staff.exchange@example.test",
    expiresAt: "2026-08-18T10:10:00.000Z",
  });
  assert.equal(disabled.data, null);
  assert.equal(disabled.error.code, "PASSWORD_RESET_ACCOUNT_DISABLED");
  assert.equal(disabled.error.statusCode, 403);
  assert.equal(disabledRepository.exchangedCodes.length, 0);
});

test("password reset completion requires a verified OTP token and resets password", async () => {
  const repository = createFakePasswordResetRepository({
    account: { email: "staff.complete@example.test", status: "active" },
  });
  const exchange = await exchangePasswordResetCodeForOperations({
    repository,
    email: "staff.complete@example.test",
    code: "123456",
    now: new Date("2026-08-18T10:00:00.000Z"),
  });

  assert.equal(exchange.error, null);

  const result = await completePasswordResetForOperations({
    repository,
    email: "staff.complete@example.test",
    token: exchange.data.token,
    newPassword: "NewStrongPass123!",
    now: new Date("2026-08-18T10:05:00.000Z"),
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.data, { reset: true });
  assert.deepEqual(repository.resetPasswords, [
    {
      token: "reset-token-staff.complete@example.test",
      newPassword: "NewStrongPass123!",
    },
  ]);
});

test("password reset completion rejects token and email mismatches before changing password", async () => {
  const repository = createFakePasswordResetRepository({
    account: { email: "staff.mismatch@example.test", status: "active" },
  });
  const exchange = await exchangePasswordResetCodeForOperations({
    repository,
    email: "staff.mismatch@example.test",
    code: "123456",
    now: new Date("2026-08-18T10:00:00.000Z"),
  });

  assert.equal(exchange.error, null);

  const result = await completePasswordResetForOperations({
    repository,
    email: "other.mismatch@example.test",
    token: exchange.data.token,
    newPassword: "NewStrongPass123!",
    now: new Date("2026-08-18T10:05:00.000Z"),
  });

  assert.equal(result.data, null);
  assert.equal(result.error.code, "PASSWORD_RESET_STATE_MISMATCH");
  assert.deepEqual(repository.resetPasswords, []);
});

test("password reset completion rejects expired app reset state", async () => {
  const repository = createFakePasswordResetRepository({
    account: { email: "staff.expired@example.test", status: "active" },
    providerTokenExpiresAt: "2026-08-18T10:30:00.000Z",
  });
  const exchange = await exchangePasswordResetCodeForOperations({
    repository,
    email: "staff.expired@example.test",
    code: "123456",
    now: new Date("2026-08-18T10:00:00.000Z"),
  });

  assert.equal(exchange.error, null);

  const result = await completePasswordResetForOperations({
    repository,
    email: "staff.expired@example.test",
    token: exchange.data.token,
    newPassword: "NewStrongPass123!",
    now: new Date("2026-08-18T10:10:01.000Z"),
  });

  assert.equal(result.data, null);
  assert.equal(result.error.code, "PASSWORD_RESET_EXPIRED");
  assert.deepEqual(repository.resetPasswords, []);
});

test("password reset completion blocks disabled Staff before changing password", async () => {
  const repository = createFakePasswordResetRepository({
    account: { email: "staff.disabled-after-otp@example.test", status: "active" },
  });
  const exchange = await exchangePasswordResetCodeForOperations({
    repository,
    email: "staff.disabled-after-otp@example.test",
    code: "123456",
    now: new Date("2026-08-18T10:00:00.000Z"),
  });

  assert.equal(exchange.error, null);
  repository.account = {
    email: "staff.disabled-after-otp@example.test",
    status: "disabled",
  };

  const result = await completePasswordResetForOperations({
    repository,
    email: "staff.disabled-after-otp@example.test",
    token: exchange.data.token,
    newPassword: "NewStrongPass123!",
    now: new Date("2026-08-18T10:05:00.000Z"),
  });

  assert.equal(result.data, null);
  assert.equal(result.error.code, "PASSWORD_RESET_ACCOUNT_DISABLED");
  assert.deepEqual(repository.resetPasswords, []);
});

function createFakePasswordResetRepository({
  account = { email: "staff@example.test", status: "active" },
  providerTokenExpiresAt = "2026-08-18T10:10:00.000Z",
}: {
  account?: PasswordResetAccount | null;
  providerTokenExpiresAt?: string;
} = {}): PasswordResetRepository & {
  account: PasswordResetAccount | null;
  sentResetEmails: string[];
  readAccounts: string[];
  exchangedCodes: { email: string; code: string }[];
  resetPasswords: { token: string; newPassword: string }[];
} {
  const sentResetEmails: string[] = [];
  const readAccounts: string[] = [];
  const exchangedCodes: { email: string; code: string }[] = [];
  const resetPasswords: { token: string; newPassword: string }[] = [];
  let currentAccount = account;
  const fakeRepository: PasswordResetRepository & {
    account: PasswordResetAccount | null;
    sentResetEmails: string[];
    readAccounts: string[];
    exchangedCodes: { email: string; code: string }[];
    resetPasswords: { token: string; newPassword: string }[];
  } = {
    get account() {
      return currentAccount;
    },
    set account(value) {
      currentAccount = value;
    },
    sentResetEmails,
    readAccounts,
    exchangedCodes,
    resetPasswords,
    async sendResetPasswordEmail({ email }) {
      sentResetEmails.push(email);
      return { data: { requested: true }, error: null };
    },
    async readPasswordResetAccount({ email }) {
      readAccounts.push(email);
      return {
        data: currentAccount?.email === email ? currentAccount : null,
        error: null,
      };
    },
    async exchangeResetPasswordToken({ email, code }) {
      exchangedCodes.push({ email, code });
      return {
        data: {
          token: `reset-token-${email}`,
          expiresAt: providerTokenExpiresAt,
        },
        error: null,
      };
    },
    async resetPassword({ token, newPassword }) {
      resetPasswords.push({ token, newPassword });
      return { data: { reset: true }, error: null };
    },
  };

  return fakeRepository;
}
