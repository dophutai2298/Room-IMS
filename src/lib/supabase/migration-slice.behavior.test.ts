import assert from "node:assert/strict";
import test from "node:test";

import { isSupabaseFoundationApiPath, isSupabaseFoundationPagePath } from "./migration-slice";

test("isolated Supabase deployment permits only migrated API routes", () => {
  for (const path of [
    "/api/auth/sign-in", "/api/auth/password-reset/request",
    "/api/foundation/current-user", "/api/rooms",
    "/api/rooms/room-101", "/api/rooms/room-101/detail",
    "/api/staff", "/api/staff/staff-1",
    "/api/tenants", "/api/tenants/tenant-1",
    "/api/rooms/room-101/tenants", "/api/rooms/room-101/contracts",
    "/api/contracts/contract-1", "/api/tenants/tenant-1/cccd-images",
    "/api/tenants/tenant-1/cccd-images/image-1",
    "/api/tenants/tenant-1/cccd-images/image-1/content",
    "/api/rooms/room-101/utility-metrics",
    "/api/utility-pricing", "/api/utility-pricing/price-1",
    "/api/invoices", "/api/invoices/invoice-1/payment",
    "/api/rooms/room-101/invoices", "/api/rooms/room-101/invoices/pdf",
    "/api/rooms/room-101/operations-summary",
    "/api/dashboard/operations-summary", "/api/dashboard/revenue",
    "/api/dashboard/missing-utility-metrics", "/api/dashboard/unpaid-invoices",
  ]) assert.equal(isSupabaseFoundationApiPath(path), true, path);

  for (const path of [
    "/api/foundation/seeded-data", "/api/dashboard/other",
  ]) assert.equal(isSupabaseFoundationApiPath(path), false, path);

  assert.equal(isSupabaseFoundationPagePath("/"), true);
});
