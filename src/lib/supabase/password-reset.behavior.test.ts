import assert from "node:assert/strict";
import test from "node:test";

import {
  completeSupabasePasswordReset,
  exchangeSupabasePasswordResetCode,
  requestSupabasePasswordReset,
  type SupabasePasswordResetRepository,
} from "./password-reset-service";

function fakeRepository() {
  const proofs = new Map<string, { authUserId: string; email: string; expiresAt: number }>();
  let updated = 0;
  let nextAllowedAt = 0;
  const repository: SupabasePasswordResetRepository = {
    async reserveRequest(_email, now) {
      if (now.getTime() < nextAllowedAt) return { data: null, error: null };
      nextAllowedAt = now.getTime() + 60_000;
      return { data: new Date(nextAllowedAt).toISOString(), error: null };
    },
    async sendEmail() { return { data: { requested: true }, error: null }; },
    async verifyCode(_email, code) {
      return code === "123456"
        ? { data: { authUserId: "auth-1" }, error: null }
        : { data: null, error: { message: "Invalid OTP", code: "INVALID", statusCode: 400 } };
    },
    async saveProof(input) {
      proofs.set(input.tokenHash, { authUserId: input.authUserId, email: input.email, expiresAt: input.expiresAt.getTime() });
      return { data: { saved: true }, error: null };
    },
    async consumeProof({ tokenHash, email, now }) {
      const proof = proofs.get(tokenHash);
      if (!proof || proof.email !== email || proof.expiresAt <= now.getTime()) {
        return { data: null, error: null };
      }
      proofs.delete(tokenHash);
      return { data: proof.authUserId, error: null };
    },
    async updatePassword() { updated += 1; return { data: { reset: true }, error: null }; },
  };
  return { repository, get updated() { return updated; } };
}

test("recovery proof is durable across service calls, single use, and expires in ten minutes", async () => {
  const fake = fakeRepository();
  const now = new Date("2026-11-24T00:00:00Z");
  const requested = await requestSupabasePasswordReset({ repository: fake.repository, email: "owner@example.test", now });
  assert.equal(requested.error, null);
  const throttled = await requestSupabasePasswordReset({ repository: fake.repository, email: "owner@example.test", now });
  assert.equal(throttled.error?.statusCode, 429);

  const wrong = await exchangeSupabasePasswordResetCode({ repository: fake.repository, email: "owner@example.test", code: "000000", now });
  assert.equal(wrong.data, null);
  const exchanged = await exchangeSupabasePasswordResetCode({ repository: fake.repository, email: "owner@example.test", code: "123456", now });
  assert.equal(exchanged.error, null);

  const completed = await completeSupabasePasswordReset({ repository: fake.repository, email: "owner@example.test", token: exchanged.data.token, newPassword: "NewStrongPassword123!", now });
  assert.equal(completed.error, null);
  const replay = await completeSupabasePasswordReset({ repository: fake.repository, email: "owner@example.test", token: exchanged.data.token, newPassword: "NewStrongPassword123!", now });
  assert.equal(replay.data, null);
  assert.equal(fake.updated, 1);

  const second = await exchangeSupabasePasswordResetCode({ repository: fake.repository, email: "owner@example.test", code: "123456", now });
  assert.ok(second.data);
  const expired = await completeSupabasePasswordReset({ repository: fake.repository, email: "owner@example.test", token: second.data.token, newPassword: "NewStrongPassword123!", now: new Date(now.getTime() + 600_001) });
  assert.equal(expired.data, null);
});
