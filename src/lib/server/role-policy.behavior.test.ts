import assert from "node:assert/strict";
import test from "node:test";

import {
  canRolePerformOperationalAction,
  getAllowedRolesForOperationalAction,
} from "./role-policy";

test("operational role policy keeps Staff read/create-only", () => {
  assert.deepEqual(getAllowedRolesForOperationalAction("read"), [
    "landlord",
    "staff",
  ]);
  assert.deepEqual(getAllowedRolesForOperationalAction("create"), [
    "landlord",
    "staff",
  ]);
  assert.deepEqual(getAllowedRolesForOperationalAction("update"), ["landlord"]);
  assert.deepEqual(getAllowedRolesForOperationalAction("delete"), ["landlord"]);
  assert.deepEqual(getAllowedRolesForOperationalAction("administer"), [
    "landlord",
  ]);

  assert.equal(canRolePerformOperationalAction("staff", "read"), true);
  assert.equal(canRolePerformOperationalAction("staff", "create"), true);
  assert.equal(canRolePerformOperationalAction("staff", "update"), false);
  assert.equal(canRolePerformOperationalAction("staff", "delete"), false);
  assert.equal(canRolePerformOperationalAction("landlord", "delete"), true);
});
