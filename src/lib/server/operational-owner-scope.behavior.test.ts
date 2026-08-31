import assert from "node:assert/strict";
import test from "node:test";

import type { AppUser } from "@/lib/insforge/types";
import {
  getActiveOwnerAppUserId,
  resolveOwnerAppUserId,
} from "./operational-owner-scope";
import { runWithOperationalAppUser } from "./operational-auth-context";

test("owner scope falls back to the signed-in landlord app user id", () => {
  const landlord = createAppUser({
    id: "landlord-app-user",
    role: "landlord",
  });

  assert.equal(resolveOwnerAppUserId(landlord), "landlord-app-user");
});

test("owner scope uses the assigned landlord id for staff", () => {
  const staff = createAppUser({
    id: "staff-app-user",
    role: "staff",
    ownerAppUserId: "landlord-app-user",
  });

  assert.equal(resolveOwnerAppUserId(staff), "landlord-app-user");
});

test("active owner scope is available inside an operational auth context", async () => {
  const staff = createAppUser({
    id: "staff-app-user",
    role: "staff",
    ownerAppUserId: "landlord-app-user",
  });

  const ownerAppUserId = await runWithOperationalAppUser(staff, async () =>
    getActiveOwnerAppUserId(),
  );

  assert.equal(ownerAppUserId, "landlord-app-user");
});

function createAppUser({
  id,
  role,
  ownerAppUserId,
}: {
  id: string;
  role: AppUser["role"];
  ownerAppUserId?: string;
}): AppUser {
  return {
    id,
    authUserId: `${id}-auth`,
    email: `${id}@example.test`,
    displayName: id,
    role,
    ownerAppUserId,
  };
}
