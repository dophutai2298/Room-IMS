import assert from "node:assert/strict";
import test from "node:test";

import { mapVerifiedSupabaseAppUser } from "./auth-mapping";

const row = {
  id: "app-landlord",
  auth_user_id: "auth-landlord",
  email: "owner@example.test",
  display_name: "Owner",
  role: "landlord" as const,
  status: "active" as const,
  credential_ready: true,
  owner_app_user_id: "app-landlord",
};

test("verified Supabase identity resolves the preserved application ID and owner", () => {
  const result = mapVerifiedSupabaseAppUser({
    identity: { id: "auth-landlord", email: "owner@example.test" },
    row,
  });
  assert.equal(result.error, null);
  assert.equal(result.data.id, "app-landlord");
  assert.equal(result.data.ownerAppUserId, "app-landlord");
});

test("unmapped, disabled and mismatched identities cannot gain operational access", () => {
  for (const input of [
    { identity: { id: "auth-landlord", email: "owner@example.test" }, row: null },
    { identity: { id: "auth-landlord", email: "owner@example.test" }, row: { ...row, status: "disabled" as const } },
    { identity: { id: "another-auth-id", email: "owner@example.test" }, row },
    { identity: { id: "auth-landlord", email: "other@example.test" }, row },
    { identity: { id: "auth-landlord", email: "owner@example.test" }, row: { ...row, credential_ready: false } },
  ]) {
    const result = mapVerifiedSupabaseAppUser(input);
    assert.equal(result.data, null);
    assert.equal(result.error?.statusCode, 403);
  }
});
