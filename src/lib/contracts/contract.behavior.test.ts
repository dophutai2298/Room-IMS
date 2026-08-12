import assert from "node:assert/strict";
import test from "node:test";

import type { AppUser } from "@/lib/insforge/types";
import { resolveOperationalAppUserResult } from "@/lib/server/operational-auth-core";
import { runContractServiceBehaviorSmoke } from "./service.behavior-smoke";

test("contract operations authenticate both Landlord and Staff", async () => {
  for (const role of ["landlord", "staff"] as const) {
    const user: AppUser = {
      id: `${role}-app-user`,
      authUserId: `${role}-auth-user`,
      email: `${role}@example.test`,
      displayName: role,
      role,
    };
    const auth = await resolveOperationalAppUserResult({
      getCurrentUser: async () => ({ data: user, error: null }),
    });

    assert.equal(auth.error, null);
    assert.equal(auth.user.role, role);
  }
});

test("contract service reads, writes, preserves overrides, and validates inputs", async () => {
  const results = await runContractServiceBehaviorSmoke();

  assert.equal(results.listContracts.error, null);
  assert.equal(results.listContracts.data.length, 1);
  assert.equal(results.createActiveContract.error, null);
  assert.equal(results.createActiveContract.data.status, "Active");

  assert.equal(results.updateContractAndPreserveOverrides.error, null);
  assert.equal(
    results.updateContractAndPreserveOverrides.data.electricityPriceOverride,
    4_100,
  );
  assert.equal(
    results.updateContractAndPreserveOverrides.data.waterPriceOverride,
    19_000,
  );

  assert.equal(
    results.rejectInvalidDateRange.error?.code,
    "CONTRACT_DATE_RANGE_INVALID",
  );
  assert.equal(results.rejectNegativeRent.error?.code, "CONTRACT_MONEY_INVALID");
});
