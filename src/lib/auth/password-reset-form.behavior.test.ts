import assert from "node:assert/strict";
import test from "node:test";

import {
  preparePasswordResetCodeSubmission,
  preparePasswordResetCompletionSubmission,
  preparePasswordResetRequestSubmission,
} from "./password-reset-form";

test("password reset request form normalizes email before submit", () => {
  const submission = preparePasswordResetRequestSubmission({
    email: " STAFF@EXAMPLE.TEST ",
  });

  assert.deepEqual(submission.fieldErrors, {});
  assert.deepEqual(submission.payload, { email: "staff@example.test" });
});

test("password reset OTP form normalizes the 6-digit code before verification", () => {
  const submission = preparePasswordResetCodeSubmission({
    email: " STAFF@EXAMPLE.TEST ",
    code: " 123456 ",
  });

  assert.deepEqual(submission.fieldErrors, {});
  assert.deepEqual(submission.payload, {
    email: "staff@example.test",
    code: "123456",
  });
});

test("password reset form blocks mismatched confirm password locally", () => {
  const submission = preparePasswordResetCompletionSubmission({
    email: "staff@example.test",
    token: "reset-token",
    newPassword: "NewStrongPass123!",
    confirmPassword: "DifferentPass123!",
  });

  assert.equal(submission.payload, null);
  assert.equal(
    submission.fieldErrors.confirmPassword,
    "Mật khẩu xác nhận không khớp.",
  );
});

test("password reset form omits confirm password from API payload", () => {
  const submission = preparePasswordResetCompletionSubmission({
    email: " STAFF@EXAMPLE.TEST ",
    token: " reset-token ",
    newPassword: "NewStrongPass123!",
    confirmPassword: "NewStrongPass123!",
  });

  assert.deepEqual(submission.fieldErrors, {});
  assert.deepEqual(submission.payload, {
    email: "staff@example.test",
    token: "reset-token",
    newPassword: "NewStrongPass123!",
  });
  assert.equal("confirmPassword" in submission.payload, false);
});
