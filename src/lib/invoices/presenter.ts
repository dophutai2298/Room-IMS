import { formatBillingPeriod, type BillingPeriod } from "@/lib/utilities/presenter";
import type { InvoiceRecord, RoomRecord } from "@/lib/insforge/types";

export type InvoicePaymentStatus = InvoiceRecord["status"];

export type InvoiceListItem = {
  id: string;
  shortId: string;
  roomId: string;
  roomName: string;
  billingPeriod: BillingPeriod;
  periodLabel: string;
  roomFee: number;
  electricityFee: number;
  waterFee: number;
  otherFee: number;
  otherFeeNote: string | null;
  utilityFee: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoicePaymentStatus;
};

export type InvoiceListJoinedRow = InvoiceRecord & {
  room: { name: string } | Array<{ name: string }> | null;
};

export const invoiceStatusLabel: Record<InvoicePaymentStatus, string> = {
  Unpaid: "Chưa thanh toán",
  "Partially Paid": "Thanh toán một phần",
  Paid: "Đã thanh toán",
};

export function buildInvoiceCode(invoice: Pick<InvoiceRecord, "id" | "month" | "year">) {
  return `INV-${String(invoice.year).slice(-2)}${String(invoice.month).padStart(2, "0")}-${invoice.id.slice(0, 8).toUpperCase()}`;
}

export function buildInvoiceList({
  invoices,
  rooms,
}: {
  invoices: InvoiceRecord[];
  rooms: Array<Pick<RoomRecord, "id" | "name">>;
}): InvoiceListItem[] {
  const roomNameById = new Map(rooms.map((room) => [room.id, room.name]));

  return invoices
    .map((invoice) =>
      buildInvoiceListItem(
        invoice,
        roomNameById.get(invoice.room_id) ?? "Unknown room",
      ),
    )
    .sort(compareInvoiceListItems);
}

export function buildInvoiceListFromJoinedRows(
  rows: InvoiceListJoinedRow[],
): InvoiceListItem[] {
  return rows
    .map(({ room: joinedRoom, ...invoice }) => {
      const room = Array.isArray(joinedRoom) ? joinedRoom[0] : joinedRoom;

      return buildInvoiceListItem(invoice, room?.name ?? "Unknown room");
    })
    .sort(compareInvoiceListItems);
}

function buildInvoiceListItem(
  invoice: InvoiceRecord,
  roomName: string,
): InvoiceListItem {
  const electricityFee = toMoney(invoice.electricity_fee);
  const waterFee = toMoney(invoice.water_fee);
  const totalAmount = toMoney(invoice.total_amount);
  const amountPaid = toMoney(invoice.amount_paid);
  const billingPeriod = {
    month: toNumber(invoice.month),
    year: toNumber(invoice.year),
  };

  return {
    id: invoice.id,
    shortId: buildInvoiceCode(invoice),
    roomId: invoice.room_id,
    roomName,
    billingPeriod,
    periodLabel: formatBillingPeriod(billingPeriod),
    roomFee: toMoney(invoice.room_fee),
    electricityFee,
    waterFee,
    otherFee: toMoney(invoice.other_fee),
    otherFeeNote: normalizeOptionalText(invoice.other_fee_note),
    utilityFee: electricityFee + waterFee,
    totalAmount,
    amountPaid,
    balanceDue: Math.max(totalAmount - amountPaid, 0),
    status: invoice.status,
  };
}

function compareInvoiceListItems(left: InvoiceListItem, right: InvoiceListItem) {
  if (left.billingPeriod.year !== right.billingPeriod.year) {
    return right.billingPeriod.year - left.billingPeriod.year;
  }

  if (left.billingPeriod.month !== right.billingPeriod.month) {
    return right.billingPeriod.month - left.billingPeriod.month;
  }

  return left.roomName.localeCompare(right.roomName);
}

function toMoney(value: number | string | null) {
  return Number(value ?? 0);
}

function toNumber(value: number | string) {
  return Number(value);
}

function normalizeOptionalText(value: string | null | undefined) {
  const cleaned = value?.trim();

  return cleaned ? cleaned : null;
}
