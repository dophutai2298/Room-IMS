import assert from "node:assert/strict";
import test from "node:test";

import { appError, ok } from "@/lib/insforge/errors";
import type { AppRole, AppUser } from "@/lib/insforge/types";
import { createInvoicePdfExportRoute } from "./export-route";
import type { InvoiceExportRepository } from "./export-repository";

const roomId = "00000000-0000-0000-0000-000000000101";

test("invoice PDF route lets Landlord and Staff download through operational auth", async () => {
  for (const role of ["landlord", "staff"] satisfies AppRole[]) {
    let authCount = 0;
    const GET = createInvoicePdfExportRoute({
      createRepository: () => createSuccessfulRepository(),
      renderPdf: async (view) => {
        assert.equal(view.tenantName, "Nguyễn Minh Khoa");
        return Uint8Array.from(new TextEncoder().encode("%PDF-1.7 route"));
      },
      now: () => new Date("2026-08-20T03:00:00.000Z"),
      resolveAuth: async () => {
        authCount += 1;
        return { user: createAppUser(role), error: null };
      },
      logTiming: () => undefined,
    });

    const response = await GET(
      new Request(
        `http://localhost/api/rooms/${roomId}/invoices/pdf?month=7&year=2026`,
      ),
      { params: Promise.resolve({ id: roomId }) },
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.equal(await response.text(), "%PDF-1.7 route");
    assert.equal(authCount, 1);
  }
});

test("invoice PDF route maps a missing invoice to the standard HTTP 404 shape", async () => {
  let renderCount = 0;
  const repository: InvoiceExportRepository = {
    async findInvoiceExportSource() {
      return appError({
        code: "INVOICE_NOT_FOUND",
        message: "Invoice was not found for the selected room and billing period.",
        statusCode: 404,
      });
    },
  };
  const GET = createInvoicePdfExportRoute({
    createRepository: () => repository,
    renderPdf: async () => {
      renderCount += 1;
      return Uint8Array.from([]);
    },
    resolveAuth: async () => ({ user: createAppUser("landlord"), error: null }),
    logTiming: () => undefined,
  });

  const response = await GET(
    new Request(
      `http://localhost/api/rooms/${roomId}/invoices/pdf?month=7&year=2026`,
    ),
    { params: Promise.resolve({ id: roomId }) },
  );
  const body = (await response.json()) as {
    ok: false;
    error: { code: string; status: number };
  };

  assert.equal(response.status, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "INVOICE_NOT_FOUND");
  assert.equal(body.error.status, 404);
  assert.equal(renderCount, 0);
});

test("invoice PDF route rejects invalid room-period targets before repository access", async () => {
  let repositoryReadCount = 0;
  const GET = createInvoicePdfExportRoute({
    createRepository: () => ({
      async findInvoiceExportSource() {
        repositoryReadCount += 1;
        return appError({
          code: "UNREACHABLE",
          message: "Repository should not run.",
          statusCode: 500,
        });
      },
    }),
    renderPdf: async () => Uint8Array.from([]),
    resolveAuth: async () => ({ user: createAppUser("staff"), error: null }),
    logTiming: () => undefined,
  });

  const response = await GET(
    new Request(
      "http://localhost/api/rooms/not-a-room/invoices/pdf?month=13&year=nope",
    ),
    { params: Promise.resolve({ id: "not-a-room" }) },
  );
  const body = (await response.json()) as {
    ok: false;
    error: { code: string };
  };

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "INVALID_INVOICE_EXPORT_TARGET");
  assert.equal(repositoryReadCount, 0);
});

function createSuccessfulRepository(): InvoiceExportRepository {
  return {
    async findInvoiceExportSource(target) {
      assert.deepEqual(target, {
        roomId,
        billingPeriod: { month: 7, year: 2026 },
      });

      return ok({
        invoice: {
          id: "00000000-0000-0000-0000-000000000501",
          room_id: roomId,
          month: 7,
          year: 2026,
          room_fee: 2_500_000,
          electricity_fee: 350_000,
          water_fee: 170_000,
          other_fee: 0,
          other_fee_note: null,
          total_amount: 3_020_000,
          amount_paid: 0,
          status: "Unpaid",
        },
        room: { id: roomId, name: "Phòng 101" },
        keyTenant: { full_name: "Nguyễn Minh Khoa" },
        utilityMetric: null,
      });
    },
  };
}

function createAppUser(role: AppRole): AppUser {
  return {
    id: `${role}-app-user`,
    authUserId: `${role}-auth-user`,
    email: `${role}@example.test`,
    displayName: role === "landlord" ? "Landlord Demo" : "Staff Demo",
    role,
    status: "active",
  };
}
