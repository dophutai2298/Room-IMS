import assert from "node:assert/strict";
import test from "node:test";

import { resolveApplicableContract } from "@/lib/contracts/billing-period";
import { ok } from "@/lib/insforge/errors";
import type {
  ContractRecord,
  InvoiceRecord,
  RoomRecord,
  UtilityMetricRecord,
} from "@/lib/insforge/types";
import { withOperationalAuth } from "@/lib/server/operational-route";
import { operationalCreateRoles } from "@/lib/server/role-policy";
import {
  buildInvoiceGenerationConditionalUpdate,
  buildInvoiceGenerationValues,
  validateInvoiceGenerationRequest,
} from "./generation";
import { createInvoiceGenerationHttpHandler } from "./generation-http";

test("Invoice generation requires a note when an other fee is charged", () => {
  const result = validateInvoiceGenerationRequest({
    roomId: "room-1",
    body: {
      month: 8,
      year: 2026,
      otherFee: 100_000,
      otherFeeNote: "   ",
    },
  });

  assert.equal(result.data, null);
  assert.equal(result.error?.code, "VALIDATION_ERROR");
  assert.deepEqual(result.error?.details, {
    fieldErrors: {
      otherFeeNote: "Nhập ghi chú để biết phí khác là phí gì.",
    },
  });
});

test("Invoice generation requires a note when a discount is applied", () => {
  const result = validateInvoiceGenerationRequest({
    roomId: "room-1",
    body: {
      month: 8,
      year: 2026,
      otherFee: 0,
      discountAmount: 100_000,
      discountNote: "   ",
    },
  });

  assert.equal(result.data, null);
  assert.equal(result.error?.code, "VALIDATION_ERROR");
  assert.deepEqual(result.error?.details, {
    fieldErrors: {
      discountNote: "Nhập ghi chú để biết lý do giảm giá.",
    },
  });
});

test("Invoice generation normalizes a valid API request", () => {
  const result = validateInvoiceGenerationRequest({
    roomId: "room-1",
    body: {
      month: "8",
      year: "2026",
      otherFee: "100000",
      otherFeeNote: "  Phụ thu vệ sinh  ",
      discountAmount: "50000",
      discountNote: "  Giảm giá khách ở lâu  ",
    },
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    roomId: "room-1",
    billingPeriod: { month: 8, year: 2026 },
    otherFee: 100_000,
    otherFeeNote: "Phụ thu vệ sinh",
    discountAmount: 50_000,
    discountNote: "Giảm giá khách ở lâu",
  });
});

test("Invoice generation subtracts discount after adding rent, utilities, and other fees", () => {
  const values = buildInvoiceGenerationValues({
    room: createRoom(),
    activeContract: createContract(),
    metric: createMetric(),
    billingPeriod: { month: 8, year: 2026 },
    electricityUnitPrice: 3_500,
    waterUnitPrice: 17_000,
    otherFee: 100_000,
    otherFeeNote: "Phụ thu vệ sinh",
    discountAmount: 200_000,
    discountNote: "Giảm giá khách ở lâu",
    existingInvoice: null,
    now: "2026-08-20T00:00:00.000Z",
  });

  assert.equal(values.room_fee, 3_000_000);
  assert.equal(values.electricity_fee, 350_000);
  assert.equal(values.water_fee, 170_000);
  assert.equal(values.other_fee, 100_000);
  assert.equal(values.discount_amount, 200_000);
  assert.equal(values.discount_note, "Giảm giá khách ở lâu");
  assert.equal(values.total_amount, 3_420_000);
});

test("Updating a generated Invoice preserves collected money and derives its status", () => {
  const values = buildInvoiceGenerationValues({
    room: createRoom(),
    activeContract: createContract(),
    metric: createMetric(),
    billingPeriod: { month: 8, year: 2026 },
    electricityUnitPrice: 3_500,
    waterUnitPrice: 17_000,
    otherFee: 100_000,
    otherFeeNote: "Phụ thu vệ sinh",
    discountAmount: 0,
    discountNote: null,
    existingInvoice: createInvoice({ amount_paid: 1_000_000 }),
    now: "2026-08-20T00:00:00.000Z",
  });

  assert.equal(values.electricity_fee, 350_000);
  assert.equal(values.water_fee, 170_000);
  assert.equal(values.total_amount, 3_620_000);
  assert.equal(values.amount_paid, 1_000_000);
  assert.equal(values.status, "Partially Paid");
  assert.equal(values.other_fee_note, "Phụ thu vệ sinh");
});

test("Invoice regeneration conditions its write on the observed payment snapshot", () => {
  const baseValues = buildInvoiceGenerationValues({
    room: createRoom(),
    activeContract: createContract(),
    metric: createMetric(),
    billingPeriod: { month: 8, year: 2026 },
    electricityUnitPrice: 3_500,
    waterUnitPrice: 17_000,
    otherFee: 0,
    discountAmount: 0,
    existingInvoice: null,
    now: "2026-08-20T00:00:00.000Z",
  });
  const conditionalUpdate = buildInvoiceGenerationConditionalUpdate(
    baseValues,
    createInvoice({ amount_paid: 1_000_000, status: "Partially Paid" }),
  );

  assert.deepEqual(conditionalUpdate.expectedPayment, {
    amountPaid: 1_000_000,
    status: "Partially Paid",
  });
  assert.equal(conditionalUpdate.values.amount_paid, 1_000_000);
  assert.equal(conditionalUpdate.values.status, "Partially Paid");
});

test("historical Invoice generation can resolve a terminated Contract that covered the period", () => {
  const terminatedContract = createContract();
  terminatedContract.status = "Terminated";
  terminatedContract.end_date = "2026-07-31";

  assert.equal(
    resolveApplicableContract({
      contracts: [terminatedContract],
      billingPeriod: { month: 7, year: 2026 },
    })?.id,
    terminatedContract.id,
  );
});

test("authenticated Invoice generation exercises validation, service, and repository through HTTP", async () => {
  const generatedInvoice = createInvoice();
  const handler = createInvoiceGenerationHttpHandler({
    createRepository: () => ({
      async generateInvoice(input) {
        assert.deepEqual(input, {
          roomId: "room-1",
          billingPeriod: { month: 8, year: 2026 },
          otherFee: 0,
          otherFeeNote: null,
          discountAmount: 0,
          discountNote: null,
        });
        return ok(generatedInvoice);
      },
    }),
  });
  const POST = withOperationalAuth(
    {
      operation: "invoices.generate.test",
      allowedRoles: operationalCreateRoles,
      resolveAuth: async () => ({
        user: {
          id: "staff-app-user",
          authUserId: "staff-auth-user",
          email: "staff@example.test",
          displayName: "Staff",
          role: "staff",
        },
        error: null,
      }),
      logTiming: () => undefined,
    },
    handler,
  );
  const response = await POST(
    new Request("http://localhost/api/rooms/room-1/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: 8, year: 2026, otherFee: 0 }),
    }),
    { params: Promise.resolve({ id: "room-1" }) },
  );
  const body = (await response.json()) as {
    ok: boolean;
    data: InvoiceRecord;
    meta: { timing: { spans: Array<{ name: string }> } };
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.id, generatedInvoice.id);
  assert.equal(
    body.meta.timing.spans.some((span) => span.name === "validation"),
    true,
  );
  assert.equal(
    body.meta.timing.spans.some((span) => span.name === "service"),
    true,
  );
});

function createRoom(): RoomRecord {
  return {
    id: "room-1",
    name: "A101",
    status: "Occupied",
    base_price: 3_000_000,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function createContract(): ContractRecord {
  return {
    id: "contract-1",
    room_id: "room-1",
    key_tenant_id: "tenant-1",
    deposit_amount: 3_000_000,
    rent_amount: 3_000_000,
    electricity_price_override: null,
    water_price_override: null,
    start_date: "2026-01-01",
    end_date: null,
    status: "Active",
  };
}

function createMetric(): UtilityMetricRecord {
  return {
    id: "metric-1",
    room_id: "room-1",
    month: 8,
    year: 2026,
    electricity_old: 100,
    electricity_new: 200,
    water_old: 10,
    water_new: 20,
  };
}

function createInvoice(
  overrides: Partial<InvoiceRecord> = {},
): InvoiceRecord {
  return {
    id: "invoice-1",
    room_id: "room-1",
    month: 8,
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
