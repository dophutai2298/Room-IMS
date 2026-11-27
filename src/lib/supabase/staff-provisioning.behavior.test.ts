import assert from "node:assert/strict";
import test from "node:test";

import { provisionSupabaseStaff } from "./staff-provisioning";

test("Staff provisioning compensates an Auth creation when profile insert fails", async () => {
  const deleted: string[] = [];
  const result = await provisionSupabaseStaff({
    email: "staff@example.test",
    createAuth: async () => ({ data: { id: "auth-new" }, error: null }),
    insertProfile: async () => ({ data: null, error: new Error("DB failed") }),
    deleteAuth: async (id) => { deleted.push(id); return { error: null }; },
  });
  assert.equal(result.data, null);
  assert.deepEqual(deleted, ["auth-new"]);
});

test("Staff provisioning does not adopt an unrelated existing Auth email", async () => {
  let inserted = false;
  const result = await provisionSupabaseStaff({
    email: "existing@example.test",
    createAuth: async () => ({ data: null, error: new Error("already registered") }),
    insertProfile: async () => { inserted = true; return { data: null, error: null }; },
    deleteAuth: async () => ({ error: null }),
  });
  assert.equal(result.data, null);
  assert.equal(inserted, false);
});

test("Staff provisioning compensates a thrown profile write", async () => {
  const deleted: string[] = [];
  const result = await provisionSupabaseStaff({
    email: "staff@example.test",
    createAuth: async () => ({ data: { id: "auth-new" }, error: null }),
    insertProfile: async () => { throw new Error("network timeout"); },
    deleteAuth: async (id) => { deleted.push(id); return { error: null }; },
  });
  assert.equal(result.data, null);
  assert.deepEqual(deleted, ["auth-new"]);
});
