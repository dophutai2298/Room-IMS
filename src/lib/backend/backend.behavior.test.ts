import assert from "node:assert/strict";
import test from "node:test";

import { selectBackend } from "./selection";

test("existing deployments keep InsForge until an explicit Supabase opt-in", () => {
  assert.equal(selectBackend(undefined), "insforge");
  assert.equal(selectBackend("insforge"), "insforge");
  assert.equal(selectBackend("supabase"), "supabase");
});

test("unknown backend configuration fails closed", () => {
  assert.throws(() => selectBackend("auto"), /Unsupported APP_BACKEND/);
});
