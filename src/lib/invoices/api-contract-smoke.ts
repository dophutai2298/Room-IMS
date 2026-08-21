import type { ApiResponse } from "@/lib/api/response";
import type { InvoiceRecord } from "@/lib/insforge/types";
import type { InvoiceListItem } from "./presenter";

const authenticatedInvoiceGenerationApiSmoke = {
  ok: true,
  data: {
    id: "00000000-0000-0000-0000-000000000501",
    room_id: "00000000-0000-0000-0000-000000000101",
    month: 7,
    year: 2026,
    room_fee: 2500000,
    electricity_fee: 350000,
    water_fee: 170000,
    other_fee: 0,
    other_fee_note: null,
    total_amount: 3020000,
    amount_paid: 0,
    status: "Unpaid",
  },
  meta: {
    timing: {
      operation: "invoices.generate",
      totalMs: 1,
      spans: [
        { name: "validation", durationMs: 1 },
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.invoice-generation", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<InvoiceRecord>;

export function getAuthenticatedInvoiceGenerationApiSmokeResponse() {
  return authenticatedInvoiceGenerationApiSmoke;
}

const authenticatedInvoiceListApiSmoke = {
  ok: true,
  data: [
    {
      id: "00000000-0000-0000-0000-000000000501",
      shortId: "INV-2607-00000000",
      roomId: "00000000-0000-0000-0000-000000000101",
      roomName: "P101",
      billingPeriod: {
        month: 7,
        year: 2026,
      },
      periodLabel: "07/2026",
      roomFee: 2500000,
      electricityFee: 350000,
      waterFee: 170000,
      otherFee: 0,
      otherFeeNote: null,
      utilityFee: 520000,
      totalAmount: 3020000,
      amountPaid: 0,
      balanceDue: 3020000,
      status: "Unpaid",
    },
  ],
  meta: {
    timing: {
      operation: "invoices.list",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.invoices-list", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<InvoiceListItem[]>;

export function getAuthenticatedInvoiceListApiSmokeResponse() {
  return authenticatedInvoiceListApiSmoke;
}

const authenticatedInvoicePaymentApiSmoke = {
  ok: true,
  data: {
    id: "00000000-0000-0000-0000-000000000501",
    shortId: "INV-2607-00000000",
    roomId: "00000000-0000-0000-0000-000000000101",
    roomName: "P101",
    billingPeriod: {
      month: 7,
      year: 2026,
    },
    periodLabel: "07/2026",
    roomFee: 2500000,
    electricityFee: 350000,
    waterFee: 170000,
    otherFee: 0,
    otherFeeNote: null,
    utilityFee: 520000,
    totalAmount: 3020000,
    amountPaid: 500000,
    balanceDue: 2520000,
    status: "Partially Paid",
  },
  meta: {
    timing: {
      operation: "invoices.payment.update",
      totalMs: 1,
      spans: [
        { name: "validation", durationMs: 1 },
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.invoice-payment-read", durationMs: 1 },
        { name: "repository.insforge.invoice-payment-write", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<InvoiceListItem>;

export function getAuthenticatedInvoicePaymentApiSmokeResponse() {
  return authenticatedInvoicePaymentApiSmoke;
}

const missingPartialPaymentAmountApiSmoke = {
  ok: false,
  error: {
    kind: "validation",
    code: "INVALID_INVOICE_PAYMENT_AMOUNT",
    message: "Nhập số tiền đã thu khi chọn thanh toán một phần.",
    status: 422,
  },
  meta: {
    timing: {
      operation: "invoices.payment.update",
      totalMs: 1,
      spans: [
        { name: "validation", durationMs: 1 },
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.invoice-payment-read", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<InvoiceListItem>;

const malformedPaymentAmountApiSmoke = {
  ok: false,
  error: {
    kind: "validation",
    code: "VALIDATION_ERROR",
    message: "Kiểm tra lại thông tin thanh toán trước khi lưu.",
    status: 400,
    details: {
      fieldErrors: {
        amountPaid: "Nhập số tiền đã thu hợp lệ.",
      },
    },
  },
  meta: {
    timing: {
      operation: "invoices.payment.update",
      totalMs: 1,
      spans: [{ name: "validation", durationMs: 1 }],
    },
  },
} satisfies ApiResponse<InvoiceListItem>;

export function getRejectedInvoicePaymentApiSmokeResponses() {
  return {
    missingPartialPaymentAmount: missingPartialPaymentAmountApiSmoke,
    malformedPaymentAmount: malformedPaymentAmountApiSmoke,
  };
}
