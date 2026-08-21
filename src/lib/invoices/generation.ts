import { validationApiError, type ApiError } from "@/lib/api/errors";
import type {
  ContractRecord,
  InvoiceDbStatus,
  InvoiceRecord,
  RoomRecord,
  UtilityMetricRecord,
} from "@/lib/insforge/types";
import type { BillingPeriod } from "@/lib/utilities/presenter";

export type GenerateInvoiceInput = {
  roomId: string;
  billingPeriod: BillingPeriod;
  otherFee: number;
  otherFeeNote: string | null;
};

export type InvoiceGenerationValues = {
  room_id: string;
  month: number;
  year: number;
  room_fee: number;
  electricity_fee: number;
  water_fee: number;
  other_fee: number;
  other_fee_note: string | null;
  total_amount: number;
  amount_paid: number;
  status: InvoiceDbStatus;
  updated_at: string;
};

type ValidationResult =
  | { data: GenerateInvoiceInput; error: null }
  | { data: null; error: ApiError };

export function validateInvoiceGenerationRequest({
  roomId,
  body,
}: {
  roomId: string;
  body: unknown;
}): ValidationResult {
  const input = isRecord(body) ? body : {};
  const month = parseInteger(input.month);
  const year = parseInteger(input.year);
  const otherFee = parseMoney(input.otherFee, 0);
  const otherFeeNote = normalizeOptionalText(input.otherFeeNote);
  const fieldErrors: Record<string, string> = {};

  if (!roomId.trim()) {
    fieldErrors.id = "Room id is required.";
  }

  if (month === null || month < 1 || month > 12) {
    fieldErrors.month = "Tháng phải nằm trong khoảng 1-12.";
  }

  if (year === null || year < 2010 || year > 2100) {
    fieldErrors.year = "Năm phải nằm trong khoảng 2010-2100.";
  }

  if (otherFee === null) {
    fieldErrors.otherFee = "Nhập phí không hợp lệ, hoặc để 0.";
  }

  if (otherFee !== null && otherFee > 0 && !otherFeeNote) {
    fieldErrors.otherFeeNote = "Nhập ghi chú để biết phí khác là phí gì.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      data: null,
      error: validationApiError({
        message: "Kiểm tra lại dữ liệu trước khi tạo hóa đơn.",
        details: { fieldErrors },
      }),
    };
  }

  return {
    data: {
      roomId: roomId.trim(),
      billingPeriod: {
        month: month as number,
        year: year as number,
      },
      otherFee: otherFee as number,
      otherFeeNote,
    },
    error: null,
  };
}

export function buildInvoiceGenerationValues({
  room,
  activeContract,
  metric,
  billingPeriod,
  electricityUnitPrice,
  waterUnitPrice,
  otherFee,
  otherFeeNote,
  existingInvoice,
  now = new Date().toISOString(),
}: {
  room: Pick<RoomRecord, "id" | "base_price">;
  activeContract: Pick<ContractRecord, "rent_amount">;
  metric: UtilityMetricRecord;
  billingPeriod: BillingPeriod;
  electricityUnitPrice: number;
  waterUnitPrice: number;
  otherFee: number;
  otherFeeNote?: string | null;
  existingInvoice: InvoiceRecord | null;
  now?: string;
}): InvoiceGenerationValues {
  const electricityConsumption =
    toMoney(metric.electricity_new) - toMoney(metric.electricity_old);
  const waterConsumption =
    toMoney(metric.water_new) - toMoney(metric.water_old);
  const roomFee = toMoney(activeContract.rent_amount ?? room.base_price);
  const electricityFee = roundMoney(
    electricityConsumption * electricityUnitPrice,
  );
  const waterFee = roundMoney(waterConsumption * waterUnitPrice);
  const safeOtherFee = roundMoney(Math.max(otherFee, 0));
  const totalAmount = roundMoney(
    roomFee + electricityFee + waterFee + safeOtherFee,
  );

  return preserveInvoicePaymentState(
    {
      room_id: room.id,
      month: billingPeriod.month,
      year: billingPeriod.year,
      room_fee: roomFee,
      electricity_fee: electricityFee,
      water_fee: waterFee,
      other_fee: safeOtherFee,
      other_fee_note:
        safeOtherFee > 0 ? normalizeOptionalText(otherFeeNote) : null,
      total_amount: totalAmount,
      amount_paid: 0,
      status: "Unpaid",
      updated_at: now,
    },
    existingInvoice,
  );
}

export function preserveInvoicePaymentState(
  values: InvoiceGenerationValues,
  existingInvoice: Pick<InvoiceRecord, "amount_paid"> | null,
): InvoiceGenerationValues {
  if (!existingInvoice) {
    return values;
  }

  const amountPaid = Math.min(
    toMoney(existingInvoice.amount_paid),
    values.total_amount,
  );

  return {
    ...values,
    amount_paid: amountPaid,
    status: deriveInvoiceStatus({
      amountPaid,
      totalAmount: values.total_amount,
    }),
  };
}

export function buildInvoiceGenerationConditionalUpdate(
  values: InvoiceGenerationValues,
  observedInvoice: Pick<InvoiceRecord, "amount_paid" | "status">,
) {
  return {
    values: preserveInvoicePaymentState(values, observedInvoice),
    expectedPayment: {
      amountPaid: observedInvoice.amount_paid,
      status: observedInvoice.status,
    },
  };
}

function deriveInvoiceStatus({
  amountPaid,
  totalAmount,
}: {
  amountPaid: number;
  totalAmount: number;
}): InvoiceDbStatus {
  if (amountPaid <= 0) {
    return "Unpaid";
  }

  if (amountPaid >= totalAmount) {
    return "Paid";
  }

  return "Partially Paid";
}

function parseInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseMoney(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeOptionalText(value: unknown) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  return cleaned || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toMoney(value: number | string | null) {
  return Number(value ?? 0);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
