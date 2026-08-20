import assert from "node:assert/strict";
import test from "node:test";

import {
  createInvoicePdfDownloadResponse,
  parseInvoicePdfExportTarget,
  type InvoicePdfBytes,
} from "./export-http";
import type { InvoiceExportView } from "./export";

const exportView: InvoiceExportView = {
  invoiceCode: "INV-2607-00000000",
  roomName: "Phòng 101",
  billingPeriod: { month: 7, year: 2026 },
  periodLabel: "07/2026",
  tenantName: "Nguyễn Minh Khoa",
  exportDateLabel: "20/08/2026",
  status: "Partially Paid",
  statusLabel: "Thanh toán một phần",
  lineItems: [
    { code: "room-rent", label: "Tiền phòng", amount: 2_500_000, note: null },
    { code: "electricity", label: "Tiền điện", amount: 350_000, note: null },
    { code: "water", label: "Tiền nước", amount: 170_000, note: null },
    {
      code: "other",
      label: "Chi phí khác",
      amount: 50_000,
      note: "Phụ thu vệ sinh",
    },
  ],
  utilityReadings: null,
  totalAmount: 3_070_000,
  amountPaid: 1_000_000,
  balanceDue: 2_070_000,
};

test("invoice PDF HTTP response downloads PDF bytes with a deterministic readable filename", async () => {
  const pdfBytes = new TextEncoder().encode("%PDF-1.7 test") as InvoicePdfBytes;
  const response = createInvoicePdfDownloadResponse({
    view: exportView,
    pdfBytes,
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="hoa-don-INV-2607-00000000-phong-101-07-2026.pdf"',
  );
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(await response.text(), "%PDF-1.7 test");
});

test("invoice PDF HTTP target rejects an invalid room and billing period with field errors", () => {
  const result = parseInvoicePdfExportTarget({
    roomId: "not-a-room-id",
    month: "13",
    year: "twenty-twenty-six",
  });

  assert.equal(result.data, null);
  assert.deepEqual(result.error, {
    kind: "validation",
    code: "INVALID_INVOICE_EXPORT_TARGET",
    message: "Kiểm tra lại phòng và kỳ hóa đơn cần xuất.",
    status: 400,
    details: {
      fieldErrors: {
        roomId: "Room id không hợp lệ.",
        month: "Tháng phải từ 1 đến 12.",
        year: "Năm phải từ 2000 đến 2100.",
      },
    },
  });
});
