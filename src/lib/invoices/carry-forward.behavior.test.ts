import assert from "node:assert/strict";
import test from "node:test";
import type { InvoiceRecord, RoomRecord } from "@/lib/insforge/types";
import { ok } from "@/lib/insforge/errors";
import { withOperationalAuth } from "@/lib/server/operational-route";
import { buildInvoiceGenerationValues } from "./generation";
import { createInvoiceGenerationHttpHandler } from "./generation-http";
import { buildInvoiceExportView } from "./export";
import { buildInvoiceExcelRows } from "./excel-export";
import { buildInvoiceList } from "./presenter";
import { buildUtilityMetricsView, type BillingPeriod } from "@/lib/utilities/presenter";

test("new invoice form suggests only the outstanding balance of the immediately preceding period", () => {
  const previousInvoice = createInvoice({
    total_amount: 3_000_000,
    amount_paid: 1_937_500,
    status: "Partially Paid",
  });
  const originalInvoice = structuredClone(previousInvoice);
  const view = buildScreen([previousInvoice]);

  assert.equal(view.invoice, null);
  assert.deepEqual(view.invoiceOtherFeeDefaults, {
    amount: 1_062_500,
    note: "Tiền nợ tháng trước",
  });
  assert.deepEqual(previousInvoice, originalInvoice);
});

test("January invoice defaults carry December debt across the year boundary", () => {
  const view = buildScreen([
    createInvoice({ month: 12, year: 2026, amount_paid: 2_937_500 }),
  ], { month: 1, year: 2027 });

  assert.deepEqual(view.invoiceOtherFeeDefaults, {
    amount: 62_500,
    note: "Tiền nợ tháng trước",
  });
});

test("existing invoice Other Fee values including zero override previous unpaid balance", () => {
  for (const otherFee of [0, 87_500]) {
    const view = buildScreen([
      createInvoice(),
      createInvoice({
        id: "invoice-current",
        month: 11,
        other_fee: otherFee,
        other_fee_note: otherFee > 0 ? "Đã thỏa thuận lại" : null,
      }),
    ]);

    assert.deepEqual(view.invoiceOtherFeeDefaults, {
      amount: otherFee,
      note: otherFee > 0 ? "Đã thỏa thuận lại" : null,
    });
  }
});

test("no previous invoice, paid or overpaid invoice, and unrelated periods or rooms never suggest debt", () => {
  const cases = [
    [],
    [createInvoice({ amount_paid: 3_000_000, status: "Paid" })],
    [createInvoice({ amount_paid: 3_100_000, status: "Paid" })],
    [createInvoice({ month: 9 })],
    [createInvoice({ month: 12 })],
    [createInvoice({ room_id: "room-other" })],
  ];

  for (const invoices of cases) {
    assert.deepEqual(buildScreen(invoices).invoiceOtherFeeDefaults, {
      amount: 0,
      note: null,
    });
  }
});

test("edited carry-forward is saved only by invoice submit and appears in invoice exports without altering previous payment", async () => {
  const previousInvoice = createInvoice({
    total_amount: 3_000_000,
    amount_paid: 2_937_500,
    status: "Partially Paid",
  });
  const originalInvoice = structuredClone(previousInvoice);
  const invoices = [previousInvoice];
  const view = buildScreen(invoices);
  const draft = {
    otherFee: String(view.invoiceOtherFeeDefaults.amount),
    otherFeeNote: view.invoiceOtherFeeDefaults.note,
  };
  assert.deepEqual(draft, {
    otherFee: "62500",
    otherFeeNote: "Tiền nợ tháng trước",
  });

  draft.otherFee = "87500";
  draft.otherFeeNote = "Tiền nợ tháng trước và phí gửi xe";
  assert.deepEqual(invoices, [originalInvoice]);
  assert.equal(buildScreen(invoices).invoice, null);

  const POST = withOperationalAuth({
    operation: "invoices.carry-forward.test",
    resolveAuth: async () => ({
      user: {
        id: "landlord-app-user",
        authUserId: "landlord-auth-user",
        email: "landlord@example.test",
        displayName: "Landlord",
        role: "landlord",
      },
      error: null,
    }),
    logTiming: () => undefined,
  }, createInvoiceGenerationHttpHandler({
    createRepository: () => ({
      async generateInvoice(input) {
        const values = buildInvoiceGenerationValues({
          ...input,
          room: { id: input.roomId, base_price: 3_000_000 },
          activeContract: { rent_amount: 3_000_000 },
          metric: {
            id: "metric-current",
            room_id: input.roomId,
            month: 11,
            year: 2026,
            electricity_old: 100,
            electricity_new: 200,
            water_old: 10,
            water_new: 20,
          },
          electricityUnitPrice: 3_500,
          waterUnitPrice: 17_000,
          existingInvoice: null,
        });
        const invoice = { ...createInvoice(), ...values, id: "invoice-current" };
        invoices.push(invoice);
        return ok(invoice);
      },
    }),
  }));
  const response = await POST(new Request("http://localhost/api/rooms/room-1/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ month: 11, year: 2026, ...draft }),
  }), { params: Promise.resolve({ id: "room-1" }) });
  const body = await response.json() as { data: InvoiceRecord };

  assert.equal(response.status, 200);
  assert.equal(body.data.other_fee, 87_500);
  assert.equal(body.data.other_fee_note, "Tiền nợ tháng trước và phí gửi xe");
  assert.equal(body.data.total_amount, 3_607_500);
  assert.deepEqual(previousInvoice, originalInvoice);
  assert.deepEqual(buildScreen(invoices).invoiceOtherFeeDefaults, {
    amount: 87_500,
    note: "Tiền nợ tháng trước và phí gửi xe",
  });

  const exported = buildInvoiceExportView({
    invoice: body.data,
    room: { id: "room-1", name: "A101" },
    keyTenant: null,
    utilityMetric: null,
    exportedAt: new Date("2026-11-02T00:00:00.000Z"),
  });
  assert.deepEqual(exported.lineItems.find((item) => item.code === "other"), {
    code: "other",
    label: "Chi phí khác",
    amount: 87_500,
    note: "Tiền nợ tháng trước và phí gửi xe",
  });
  assert.equal(exported.totalAmount, 3_607_500);
  const [excelRow] = buildInvoiceExcelRows(buildInvoiceList({
    invoices: [body.data],
    rooms: [{ id: "room-1", name: "A101" }],
  }));
  assert.equal(excelRow.otherFee, 87_500);
  assert.equal(excelRow.otherFeeNote, "Tiền nợ tháng trước và phí gửi xe");
  assert.equal(excelRow.totalAmount, 3_607_500);
});

function buildScreen(
  invoices: InvoiceRecord[],
  billingPeriod: BillingPeriod = { month: 11, year: 2026 },
) {
  const room: RoomRecord = {
    id: "room-1",
    name: "A101",
    status: "Occupied",
    base_price: 3_000_000,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  return buildUtilityMetricsView({
    room,
    billingPeriod,
    tenants: [],
    activeContract: null,
    metrics: [],
    invoices,
  });
}

function createInvoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: "invoice-previous",
    room_id: "room-1",
    month: 10,
    year: 2026,
    room_fee: 3_000_000,
    electricity_fee: 0,
    water_fee: 0,
    other_fee: 0,
    other_fee_note: null,
    discount_amount: 0,
    discount_note: null,
    total_amount: 3_000_000,
    amount_paid: 0,
    status: "Unpaid",
    ...overrides,
  };
}
