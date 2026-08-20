import {
  invoiceStatusLabel,
  type InvoiceListItem,
  type InvoicePaymentStatus,
} from "./presenter";

export type InvoiceExcelRow = {
  invoiceCode: string;
  billingPeriod: string;
  roomName: string;
  roomFee: number;
  electricityFee: number;
  waterFee: number;
  otherFee: number;
  otherFeeNote: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: string;
};

export type InvoiceExcelColumn = {
  key: keyof InvoiceExcelRow;
  header: string;
  width: number;
  kind: "text" | "money";
};

export const INVOICE_EXCEL_COLUMNS: InvoiceExcelColumn[] = [
  { key: "invoiceCode", header: "Mã hóa đơn", width: 24, kind: "text" },
  { key: "billingPeriod", header: "Kỳ thu", width: 12, kind: "text" },
  { key: "roomName", header: "Phòng", width: 18, kind: "text" },
  { key: "roomFee", header: "Tiền thuê", width: 16, kind: "money" },
  { key: "electricityFee", header: "Tiền điện", width: 16, kind: "money" },
  { key: "waterFee", header: "Tiền nước", width: 16, kind: "money" },
  { key: "otherFee", header: "Phí khác", width: 16, kind: "money" },
  {
    key: "otherFeeNote",
    header: "Ghi chú phí khác",
    width: 32,
    kind: "text",
  },
  { key: "totalAmount", header: "Tổng tiền", width: 17, kind: "money" },
  { key: "amountPaid", header: "Đã thu", width: 17, kind: "money" },
  { key: "balanceDue", header: "Còn lại", width: 17, kind: "money" },
  {
    key: "paymentStatus",
    header: "Trạng thái thanh toán",
    width: 24,
    kind: "text",
  },
];

export function buildInvoiceExcelRows(
  invoices: InvoiceListItem[],
): InvoiceExcelRow[] {
  return invoices.map((invoice) => ({
    invoiceCode: invoice.shortId,
    billingPeriod: invoice.periodLabel,
    roomName: invoice.roomName,
    roomFee: invoice.roomFee,
    electricityFee: invoice.electricityFee,
    waterFee: invoice.waterFee,
    otherFee: invoice.otherFee,
    otherFeeNote: invoice.otherFeeNote ?? "",
    totalAmount: invoice.totalAmount,
    amountPaid: invoice.amountPaid,
    balanceDue: invoice.balanceDue,
    paymentStatus: invoiceStatusLabel[invoice.status].normalize("NFC"),
  }));
}

export function buildInvoiceExcelFilename({
  periodKey,
  paymentStatus,
  searchText,
  exportedAt = new Date(),
}: {
  periodKey: string;
  paymentStatus: InvoicePaymentStatus | null;
  searchText: string;
  exportedAt?: Date;
}) {
  const context = [
    periodKey === "all" ? "tat-ca-ky" : slugify(periodKey),
    paymentStatus
      ? slugify(invoiceStatusLabel[paymentStatus])
      : "tat-ca-trang-thai",
    truncateSlug(slugify(searchText)),
    formatFilenameDate(exportedAt),
  ].filter(Boolean);

  return `hoa-don_${context.join("_")}.xlsx`;
}

function slugify(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[đĐ]/g, "d")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function truncateSlug(value: string) {
  return value.slice(0, 48).replace(/-+$/g, "");
}

function formatFilenameDate(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}
