import assert from "node:assert/strict";
import test from "node:test";

import { isSupabaseFoundationApiPath } from "./migration-slice";

test("isolated Supabase deployment permits only migrated API routes", () => {
  for (const path of [
    "/api/auth/sign-in", "/api/auth/password-reset/request",
    "/api/foundation/current-user", "/api/rooms",
    "/api/rooms/room-101", "/api/rooms/room-101/detail",
    "/api/staff", "/api/staff/staff-1",
  ]) assert.equal(isSupabaseFoundationApiPath(path), true, path);

  for (const path of [
    "/api/tenants", "/api/rooms/room-101/tenants",
    "/api/rooms/room-101/contracts", "/api/rooms/room-101/operations-summary",
    "/api/dashboard/revenue", "/api/foundation/seeded-data",
  ]) assert.equal(isSupabaseFoundationApiPath(path), false, path);
});
