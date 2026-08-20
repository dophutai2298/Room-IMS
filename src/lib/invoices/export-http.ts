import { validationApiError, type ApiError } from "@/lib/api/errors";
import type { BillingPeriod } from "@/lib/utilities/presenter";
import type { InvoiceExportView } from "./export";

export type InvoicePdfBytes = Uint8Array<ArrayBuffer>;

type InvoicePdfExportTargetResult =
  | {
      data: { roomId: string; billingPeriod: BillingPeriod };
      error: null;
    }
  | { data: null; error: ApiError };

export function parseInvoicePdfExportTarget({
  roomId,
  month,
  year,
}: {
  roomId: string;
  month: string | null;
  year: string | null;
}): InvoicePdfExportTargetResult {
  const parsedMonth = parseInteger(month);
  const parsedYear = parseInteger(year);
  const fieldErrors: Record<string, string> = {};

  if (!isUuid(roomId)) {
    fieldErrors.roomId = "Room id không hợp lệ.";
  }

  if (parsedMonth === null || parsedMonth < 1 || parsedMonth > 12) {
    fieldErrors.month = "Tháng phải từ 1 đến 12.";
  }

  if (parsedYear === null || parsedYear < 2000 || parsedYear > 2100) {
    fieldErrors.year = "Năm phải từ 2000 đến 2100.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      data: null,
      error: validationApiError({
        code: "INVALID_INVOICE_EXPORT_TARGET",
        message: "Kiểm tra lại phòng và kỳ hóa đơn cần xuất.",
        details: { fieldErrors },
      }),
    };
  }

  return {
    data: {
      roomId,
      billingPeriod: {
        month: parsedMonth as number,
        year: parsedYear as number,
      },
    },
    error: null,
  };
}

export function createInvoicePdfDownloadResponse({
  view,
  pdfBytes,
}: {
  view: InvoiceExportView;
  pdfBytes: InvoicePdfBytes;
}) {
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${buildInvoicePdfFilename(view)}"`,
      "Content-Length": String(pdfBytes.byteLength),
      "Content-Type": "application/pdf",
    },
  });
}

export function buildInvoicePdfFilename(
  view: Pick<
    InvoiceExportView,
    "billingPeriod" | "invoiceCode" | "roomName"
  >,
) {
  const roomSlug = toFilenameSlug(view.roomName) || "room";
  const month = String(view.billingPeriod.month).padStart(2, "0");

  return [
    "hoa-don",
    sanitizeFilenameSegment(view.invoiceCode),
    roomSlug,
    month,
    view.billingPeriod.year,
  ].join("-") + ".pdf";
}

function toFilenameSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (letter) => (letter === "đ" ? "d" : "D"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeFilenameSegment(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseInteger(value: string | null) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
