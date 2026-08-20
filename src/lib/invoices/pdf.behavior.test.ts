import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";

import type { InvoiceExportView } from "./export";
import { formatInvoicePdfCurrency, renderInvoicePdf } from "./pdf";

test("invoice PDF currency text only uses glyphs supported by the embedded Geist font", async () => {
  const fontBytes = await readFile(
    path.join(
      process.cwd(),
      "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
    ),
  );
  const font = fontkit.create(fontBytes);
  const currencyText = formatInvoicePdfCurrency(2_800_000);
  const unsupportedCharacters = [...currencyText].filter(
    (character) =>
      !font.hasGlyphForCodePoint(character.codePointAt(0) as number),
  );

  assert.equal(currencyText, "2.800.000 đ");
  assert.deepEqual(unsupportedCharacters, []);
});

test("invoice PDF renderer produces a readable PDF document for Vietnamese customer data", async () => {
  const view = createInvoiceExportView();

  const pdfBytes = await renderInvoicePdf(view);
  const document = await PDFDocument.load(pdfBytes);

  assert.equal(new TextDecoder("latin1").decode(pdfBytes.slice(0, 5)), "%PDF-");
  assert.equal(document.getPageCount(), 1);
  assert.equal(document.getTitle(), "Hóa đơn INV-2607-00000000");
  assert.equal(document.getSubject(), "Hóa đơn tiền phòng kỳ 07/2026");
});

test("invoice PDF renderer continues an unrestricted other-fee note across pages", async () => {
  const view = createInvoiceExportView();
  view.lineItems[3] = {
    ...view.lineItems[3],
    note: Array.from({ length: 900 }, (_, index) => `phụ-thu-${index}`).join(
      " ",
    ),
  };

  const pdfBytes = await renderInvoicePdf(view);
  const document = await PDFDocument.load(pdfBytes);

  assert.ok(document.getPageCount() > 1);
  assert.equal(document.getTitle(), "Hóa đơn INV-2607-00000000");
});

function createInvoiceExportView(): InvoiceExportView {
  return {
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
    utilityReadings: {
      electricity: {
        oldReading: 1_200,
        newReading: 1_300,
        consumption: 100,
        unit: "kWh",
      },
      water: {
        oldReading: 80,
        newReading: 90,
        consumption: 10,
        unit: "m³",
      },
    },
    totalAmount: 3_070_000,
    amountPaid: 1_000_000,
    balanceDue: 2_070_000,
  };
}
