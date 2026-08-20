import type {
  InvoiceRecord,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
} from "@/lib/insforge/types";
import { formatBillingPeriod, type BillingPeriod } from "@/lib/utilities/presenter";
import {
  buildInvoiceCode,
  invoiceStatusLabel,
  type InvoicePaymentStatus,
} from "./presenter";

export type InvoiceExportLineItemCode =
  | "room-rent"
  | "electricity"
  | "water"
  | "other";

export type InvoiceExportLineItem = {
  code: InvoiceExportLineItemCode;
  label: string;
  amount: number;
  note: string | null;
};

export type InvoiceExportUtilityReading = {
  oldReading: number;
  newReading: number;
  consumption: number;
  unit: string;
};

export type InvoiceExportView = {
  invoiceCode: string;
  roomName: string;
  billingPeriod: BillingPeriod;
  periodLabel: string;
  tenantName: string | null;
  exportDateLabel: string;
  status: InvoicePaymentStatus;
  statusLabel: string;
  lineItems: InvoiceExportLineItem[];
  utilityReadings: {
    electricity: InvoiceExportUtilityReading;
    water: InvoiceExportUtilityReading;
  } | null;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
};

export function buildInvoiceExportView({
  invoice,
  room,
  keyTenant,
  utilityMetric,
  exportedAt,
}: {
  invoice: InvoiceRecord;
  room: Pick<RoomRecord, "id" | "name">;
  keyTenant: Pick<TenantRecord, "full_name"> | null;
  utilityMetric: UtilityMetricRecord | null;
  exportedAt: Date;
}): InvoiceExportView {
  const billingPeriod = {
    month: toNumber(invoice.month),
    year: toNumber(invoice.year),
  };
  const totalAmount = toMoney(invoice.total_amount);
  const amountPaid = toMoney(invoice.amount_paid);

  return {
    invoiceCode: buildInvoiceCode(invoice),
    roomName: room.name,
    billingPeriod,
    periodLabel: formatBillingPeriod(billingPeriod),
    tenantName: normalizeOptionalText(keyTenant?.full_name),
    exportDateLabel: formatExportDate(exportedAt),
    status: invoice.status,
    statusLabel: invoiceStatusLabel[invoice.status].normalize("NFC"),
    lineItems: [
      createLineItem("room-rent", "Tiền phòng", invoice.room_fee),
      createLineItem("electricity", "Tiền điện", invoice.electricity_fee),
      createLineItem("water", "Tiền nước", invoice.water_fee),
      createLineItem(
        "other",
        "Chi phí khác",
        invoice.other_fee,
        normalizeOptionalText(invoice.other_fee_note),
      ),
    ],
    utilityReadings: utilityMetric
      ? {
          electricity: createReading({
            oldReading: utilityMetric.electricity_old,
            newReading: utilityMetric.electricity_new,
            unit: "kWh",
          }),
          water: createReading({
            oldReading: utilityMetric.water_old,
            newReading: utilityMetric.water_new,
            unit: "m³",
          }),
        }
      : null,
    totalAmount,
    amountPaid,
    balanceDue: Math.max(totalAmount - amountPaid, 0),
  };
}

function createLineItem(
  code: InvoiceExportLineItemCode,
  label: string,
  amount: number | string | null,
  note: string | null = null,
): InvoiceExportLineItem {
  return {
    code,
    label,
    amount: toMoney(amount),
    note,
  };
}

function createReading({
  oldReading,
  newReading,
  unit,
}: {
  oldReading: number | string;
  newReading: number | string;
  unit: string;
}): InvoiceExportUtilityReading {
  const normalizedOldReading = toNumber(oldReading);
  const normalizedNewReading = toNumber(newReading);

  return {
    oldReading: normalizedOldReading,
    newReading: normalizedNewReading,
    consumption: normalizedNewReading - normalizedOldReading,
    unit,
  };
}

function formatExportDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toMoney(value: number | string | null) {
  return Number(value ?? 0);
}

function toNumber(value: number | string) {
  return Number(value);
}
