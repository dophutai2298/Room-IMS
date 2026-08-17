import assert from "node:assert/strict";
import test from "node:test";

import { prepareCreateStaffSubmission } from "./create-staff-form";

test("create Staff form blocks mismatched confirm password locally", () => {
  const submission = prepareCreateStaffSubmission({
    displayName: "Nguyen Van An",
    email: "staff@example.test",
    password: "StrongPass123!",
    confirmPassword: "DifferentPass123!",
  });

  assert.equal(submission.payload, null);
  assert.equal(
    submission.fieldErrors.confirmPassword,
    "Mật khẩu xác nhận không khớp.",
  );
});

test("create Staff form omits confirm password from API payload", () => {
  const submission = prepareCreateStaffSubmission({
    displayName: "Nguyen Van An",
    email: "staff@example.test",
    password: "StrongPass123!",
    confirmPassword: "StrongPass123!",
  });

  assert.deepEqual(submission.fieldErrors, {});
  assert.deepEqual(submission.payload, {
    displayName: "Nguyen Van An",
    email: "staff@example.test",
    password: "StrongPass123!",
  });
  assert.equal("confirmPassword" in submission.payload, false);
});
