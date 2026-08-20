import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import type { InvoiceExportView } from "./export";
import type { InvoicePdfBytes } from "./export-http";

const pageWidth = 595.28;
const pageHeight = 841.89;
const pageMargin = 48;
const contentWidth = pageWidth - pageMargin * 2;
const pageContentBottom = 72;

const colors = {
  ink: rgb(0.09, 0.12, 0.18),
  muted: rgb(0.38, 0.43, 0.5),
  border: rgb(0.86, 0.88, 0.91),
  surface: rgb(0.96, 0.97, 0.98),
  primary: rgb(0.16, 0.31, 0.58),
  primarySoft: rgb(0.9, 0.94, 1),
  success: rgb(0.04, 0.48, 0.31),
};

let fontBytesPromise:
  | Promise<{ regular: Buffer; semibold: Buffer }>
  | undefined;

export async function renderInvoicePdf(
  view: InvoiceExportView,
): Promise<InvoicePdfBytes> {
  const pdfDocument = await PDFDocument.create();
  const fontBytes = await loadInvoiceFontBytes();

  pdfDocument.registerFontkit(fontkit);
  const [regularFont, semiboldFont] = await Promise.all([
    pdfDocument.embedFont(fontBytes.regular, { subset: true }),
    pdfDocument.embedFont(fontBytes.semibold, { subset: true }),
  ]);

  pdfDocument.setTitle(`Hóa đơn ${view.invoiceCode}`);
  pdfDocument.setSubject(`Hóa đơn tiền phòng kỳ ${view.periodLabel}`);
  pdfDocument.setAuthor("Rental Room Management");
  pdfDocument.setCreator("Rental Room Management");
  pdfDocument.setProducer("Rental Room Management");

  const page = pdfDocument.addPage([pageWidth, pageHeight]);
  drawInvoicePage({ pdfDocument, page, regularFont, semiboldFont, view });

  return Uint8Array.from(
    await pdfDocument.save({
      useObjectStreams: true,
    }),
  ) as InvoicePdfBytes;
}

export function formatInvoicePdfCurrency(value: number) {
  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(value)} đ`;
}

function drawInvoicePage({
  pdfDocument,
  page,
  regularFont,
  semiboldFont,
  view,
}: {
  pdfDocument: PDFDocument;
  page: PDFPage;
  regularFont: PDFFont;
  semiboldFont: PDFFont;
  view: InvoiceExportView;
}) {
  page.drawRectangle({
    x: 0,
    y: pageHeight - 12,
    width: pageWidth,
    height: 12,
    color: colors.primary,
  });

  page.drawText("HÓA ĐƠN TIỀN PHÒNG", {
    x: pageMargin,
    y: pageHeight - 70,
    size: 24,
    font: semiboldFont,
    color: colors.ink,
  });
  page.drawText(`Kỳ thanh toán ${view.periodLabel}`, {
    x: pageMargin,
    y: pageHeight - 91,
    size: 10.5,
    font: regularFont,
    color: colors.muted,
  });

  drawStatusPill({
    page,
    font: semiboldFont,
    label: view.statusLabel,
    x: pageWidth - pageMargin,
    y: pageHeight - 76,
  });

  const informationTop = pageHeight - 124;
  page.drawRectangle({
    x: pageMargin,
    y: informationTop - 106,
    width: contentWidth,
    height: 106,
    color: colors.surface,
    borderColor: colors.border,
    borderWidth: 0.8,
  });

  const leftX = pageMargin + 18;
  const rightX = pageMargin + contentWidth / 2 + 8;
  drawMetaField({
    page,
    regularFont,
    semiboldFont,
    label: "Mã hóa đơn",
    value: view.invoiceCode,
    x: leftX,
    y: informationTop - 26,
    maxWidth: 210,
  });
  drawMetaField({
    page,
    regularFont,
    semiboldFont,
    label: "Phòng",
    value: view.roomName,
    x: leftX,
    y: informationTop - 67,
    maxWidth: 210,
  });
  drawMetaField({
    page,
    regularFont,
    semiboldFont,
    label: "Người thuê",
    value: view.tenantName ?? "Chưa có thông tin",
    x: rightX,
    y: informationTop - 26,
    maxWidth: 210,
  });
  drawMetaField({
    page,
    regularFont,
    semiboldFont,
    label: "Ngày xuất",
    value: view.exportDateLabel,
    x: rightX,
    y: informationTop - 67,
    maxWidth: 210,
  });

  let cursorY = informationTop - 144;
  page.drawText("CHI TIẾT CHI PHÍ", {
    x: pageMargin,
    y: cursorY,
    size: 11,
    font: semiboldFont,
    color: colors.primary,
  });
  cursorY -= 18;

  page.drawRectangle({
    x: pageMargin,
    y: cursorY - 26,
    width: contentWidth,
    height: 26,
    color: colors.primarySoft,
  });
  page.drawText("Khoản phí", {
    x: pageMargin + 14,
    y: cursorY - 17,
    size: 9.5,
    font: semiboldFont,
    color: colors.primary,
  });
  drawRightAlignedText({
    page,
    font: semiboldFont,
    text: "Thành tiền",
    rightX: pageWidth - pageMargin - 14,
    y: cursorY - 17,
    size: 9.5,
    color: colors.primary,
  });
  cursorY -= 26;

  let activePage = page;

  for (const item of view.lineItems) {
    const noteLines = item.note
      ? wrapText({
          text: `Ghi chú: ${cleanText(item.note)}`,
          font: regularFont,
          size: 8.5,
          maxWidth: contentWidth - 28,
        })
      : [];
    let noteLineIndex = 0;
    let isFirstChunk = true;

    do {
      const hasRemainingNote = noteLineIndex < noteLines.length;
      const minimumRowHeight = hasRemainingNote ? 46 : 34;

      if (cursorY - minimumRowHeight < pageContentBottom) {
        const continuation = addInvoiceContinuationPage({
          pdfDocument,
          regularFont,
          semiboldFont,
          view,
        });
        activePage = continuation.page;
        cursorY = continuation.cursorY;
      }

      const availableNoteLineCount = hasRemainingNote
        ? Math.max(
            1,
            Math.floor((cursorY - pageContentBottom - 35) / 11),
          )
        : 0;
      const chunkLines = noteLines.slice(
        noteLineIndex,
        noteLineIndex + availableNoteLineCount,
      );
      const rowHeight = chunkLines.length > 0 ? 35 + chunkLines.length * 11 : 34;

      drawExpenseRow({
        page: activePage,
        regularFont,
        semiboldFont,
        label: isFirstChunk ? item.label : `${item.label} (tiếp)`,
        amount: isFirstChunk ? formatInvoicePdfCurrency(item.amount) : null,
        noteLines: chunkLines,
        topY: cursorY,
        rowHeight,
      });

      cursorY -= rowHeight;
      noteLineIndex += chunkLines.length;
      isFirstChunk = false;

      if (noteLineIndex < noteLines.length) {
        const continuation = addInvoiceContinuationPage({
          pdfDocument,
          regularFont,
          semiboldFont,
          view,
        });
        activePage = continuation.page;
        cursorY = continuation.cursorY;
      }
    } while (isFirstChunk || noteLineIndex < noteLines.length);
  }

  const summaryHeight = view.utilityReadings ? 220 : 150;
  if (cursorY - summaryHeight < pageContentBottom) {
    const continuation = addInvoiceContinuationPage({
      pdfDocument,
      regularFont,
      semiboldFont,
      view,
    });
    activePage = continuation.page;
    cursorY = continuation.cursorY;
  }

  cursorY -= 24;
  if (view.utilityReadings) {
    cursorY = drawUtilityReadings({
      page: activePage,
      regularFont,
      semiboldFont,
      view,
      topY: cursorY,
    });
  }

  drawTotals({
    page: activePage,
    regularFont,
    semiboldFont,
    view,
    topY: cursorY - 24,
  });

  drawInvoiceFooters({
    pages: pdfDocument.getPages(),
    regularFont,
  });
}

function drawExpenseRow({
  page,
  regularFont,
  semiboldFont,
  label,
  amount,
  noteLines,
  topY,
  rowHeight,
}: {
  page: PDFPage;
  regularFont: PDFFont;
  semiboldFont: PDFFont;
  label: string;
  amount: string | null;
  noteLines: string[];
  topY: number;
  rowHeight: number;
}) {
  page.drawRectangle({
    x: pageMargin,
    y: topY - rowHeight,
    width: contentWidth,
    height: rowHeight,
    borderColor: colors.border,
    borderWidth: 0.5,
  });
  page.drawText(cleanText(label), {
    x: pageMargin + 14,
    y: topY - 21,
    size: 10.5,
    font: regularFont,
    color: colors.ink,
  });

  if (amount) {
    drawRightAlignedText({
      page,
      font: semiboldFont,
      text: amount,
      rightX: pageWidth - pageMargin - 14,
      y: topY - 21,
      size: 10.5,
      color: colors.ink,
    });
  }

  noteLines.forEach((line, index) => {
    page.drawText(line, {
      x: pageMargin + 14,
      y: topY - 36 - index * 11,
      size: 8.5,
      font: regularFont,
      color: colors.muted,
    });
  });
}

function addInvoiceContinuationPage({
  pdfDocument,
  regularFont,
  semiboldFont,
  view,
}: {
  pdfDocument: PDFDocument;
  regularFont: PDFFont;
  semiboldFont: PDFFont;
  view: InvoiceExportView;
}) {
  const page = pdfDocument.addPage([pageWidth, pageHeight]);
  page.drawRectangle({
    x: 0,
    y: pageHeight - 12,
    width: pageWidth,
    height: 12,
    color: colors.primary,
  });
  page.drawText("HÓA ĐƠN TIỀN PHÒNG (TIẾP)", {
    x: pageMargin,
    y: pageHeight - 62,
    size: 17,
    font: semiboldFont,
    color: colors.ink,
  });
  page.drawText(`${view.invoiceCode} · Kỳ ${view.periodLabel}`, {
    x: pageMargin,
    y: pageHeight - 82,
    size: 9.5,
    font: regularFont,
    color: colors.muted,
  });

  return {
    page,
    cursorY: pageHeight - 112,
  };
}

function drawInvoiceFooters({
  pages,
  regularFont,
}: {
  pages: PDFPage[];
  regularFont: PDFFont;
}) {
  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: pageMargin, y: 48 },
      end: { x: pageWidth - pageMargin, y: 48 },
      color: colors.border,
      thickness: 0.7,
    });
    page.drawText(
      "Vui lòng liên hệ người quản lý nếu cần đối chiếu thông tin hóa đơn.",
      {
        x: pageMargin,
        y: 29,
        size: 8.5,
        font: regularFont,
        color: colors.muted,
      },
    );
    drawRightAlignedText({
      page,
      font: regularFont,
      text: `Trang ${index + 1}/${pages.length}`,
      rightX: pageWidth - pageMargin,
      y: 29,
      size: 8.5,
      color: colors.muted,
    });
  });
}

function drawUtilityReadings({
  page,
  regularFont,
  semiboldFont,
  view,
  topY,
}: {
  page: PDFPage;
  regularFont: PDFFont;
  semiboldFont: PDFFont;
  view: InvoiceExportView;
  topY: number;
}) {
  const readings = view.utilityReadings;
  if (!readings) {
    return topY;
  }

  page.drawText("CHỈ SỐ SỬ DỤNG", {
    x: pageMargin,
    y: topY,
    size: 11,
    font: semiboldFont,
    color: colors.primary,
  });

  const boxTop = topY - 14;
  const boxHeight = 54;
  page.drawRectangle({
    x: pageMargin,
    y: boxTop - boxHeight,
    width: contentWidth,
    height: boxHeight,
    color: colors.surface,
    borderColor: colors.border,
    borderWidth: 0.7,
  });

  const columns = [
    { label: "Điện", reading: readings.electricity },
    { label: "Nước", reading: readings.water },
  ];

  columns.forEach(({ label, reading }, index) => {
    const x = pageMargin + 16 + index * (contentWidth / 2);
    page.drawText(label, {
      x,
      y: boxTop - 20,
      size: 9.5,
      font: semiboldFont,
      color: colors.ink,
    });
    page.drawText(
      `${formatNumber(reading.oldReading)} → ${formatNumber(reading.newReading)} ${reading.unit}  ·  Tiêu thụ ${formatNumber(reading.consumption)} ${reading.unit}`,
      {
        x,
        y: boxTop - 38,
        size: 8.5,
        font: regularFont,
        color: colors.muted,
      },
    );
  });

  return boxTop - boxHeight;
}

function drawTotals({
  page,
  regularFont,
  semiboldFont,
  view,
  topY,
}: {
  page: PDFPage;
  regularFont: PDFFont;
  semiboldFont: PDFFont;
  view: InvoiceExportView;
  topY: number;
}) {
  const boxWidth = 252;
  const boxHeight = 102;
  const x = pageWidth - pageMargin - boxWidth;
  page.drawRectangle({
    x,
    y: topY - boxHeight,
    width: boxWidth,
    height: boxHeight,
    borderColor: colors.border,
    borderWidth: 0.8,
  });

  drawTotalRow({
    page,
    regularFont,
    semiboldFont,
    label: "Tổng cộng",
    value: formatInvoicePdfCurrency(view.totalAmount),
    x,
    y: topY - 24,
  });
  drawTotalRow({
    page,
    regularFont,
    semiboldFont,
    label: "Đã thanh toán",
    value: formatInvoicePdfCurrency(view.amountPaid),
    x,
    y: topY - 50,
  });
  page.drawRectangle({
    x,
    y: topY - boxHeight,
    width: boxWidth,
    height: 38,
    color: colors.primarySoft,
  });
  drawTotalRow({
    page,
    regularFont,
    semiboldFont,
    label: "Còn phải trả",
    value: formatInvoicePdfCurrency(view.balanceDue),
    x,
    y: topY - 82,
    emphasized: true,
  });
}

function drawMetaField({
  page,
  regularFont,
  semiboldFont,
  label,
  value,
  x,
  y,
  maxWidth,
}: {
  page: PDFPage;
  regularFont: PDFFont;
  semiboldFont: PDFFont;
  label: string;
  value: string;
  x: number;
  y: number;
  maxWidth: number;
}) {
  page.drawText(label.toUpperCase(), {
    x,
    y,
    size: 7.5,
    font: semiboldFont,
    color: colors.muted,
  });
  page.drawText(fitText(cleanText(value), regularFont, 10.5, maxWidth), {
    x,
    y: y - 16,
    size: 10.5,
    font: regularFont,
    color: colors.ink,
  });
}

function drawStatusPill({
  page,
  font,
  label,
  x,
  y,
}: {
  page: PDFPage;
  font: PDFFont;
  label: string;
  x: number;
  y: number;
}) {
  const size = 9;
  const horizontalPadding = 11;
  const width = font.widthOfTextAtSize(label, size) + horizontalPadding * 2;

  page.drawRectangle({
    x: x - width,
    y: y - 5,
    width,
    height: 24,
    color: colors.primarySoft,
  });
  page.drawText(label, {
    x: x - width + horizontalPadding,
    y: y + 3,
    size,
    font,
    color: colors.primary,
  });
}

function drawTotalRow({
  page,
  regularFont,
  semiboldFont,
  label,
  value,
  x,
  y,
  emphasized = false,
}: {
  page: PDFPage;
  regularFont: PDFFont;
  semiboldFont: PDFFont;
  label: string;
  value: string;
  x: number;
  y: number;
  emphasized?: boolean;
}) {
  const font = emphasized ? semiboldFont : regularFont;
  const color = emphasized ? colors.primary : colors.ink;
  const size = emphasized ? 11 : 9.5;
  page.drawText(label, {
    x: x + 14,
    y,
    size,
    font,
    color,
  });
  drawRightAlignedText({
    page,
    font: semiboldFont,
    text: value,
    rightX: x + 238,
    y,
    size,
    color,
  });
}

function drawRightAlignedText({
  page,
  font,
  text,
  rightX,
  y,
  size,
  color,
}: {
  page: PDFPage;
  font: PDFFont;
  text: string;
  rightX: number;
  y: number;
  size: number;
  color: ReturnType<typeof rgb>;
}) {
  page.drawText(text, {
    x: rightX - font.widthOfTextAtSize(text, size),
    y,
    size,
    font,
    color,
  });
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text;
  }

  const suffix = "…";
  let fitted = text;
  while (
    fitted.length > 0 &&
    font.widthOfTextAtSize(`${fitted}${suffix}`, size) > maxWidth
  ) {
    fitted = fitted.slice(0, -1);
  }

  return `${fitted.trimEnd()}${suffix}`;
}

function wrapText({
  text,
  font,
  size,
  maxWidth,
}: {
  text: string;
  font: PDFFont;
  size: number;
  maxWidth: number;
}) {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }

      const chunks = splitOversizedWord({ word, font, size, maxWidth });
      lines.push(...chunks.slice(0, -1));
      currentLine = chunks.at(-1) ?? "";
      continue;
    }

    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function splitOversizedWord({
  word,
  font,
  size,
  maxWidth,
}: {
  word: string;
  font: PDFFont;
  size: number;
  maxWidth: number;
}) {
  const chunks: string[] = [];
  let chunk = "";

  for (const character of word) {
    const candidate = `${chunk}${character}`;

    if (chunk && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      chunks.push(chunk);
      chunk = character;
      continue;
    }

    chunk = candidate;
  }

  if (chunk) {
    chunks.push(chunk);
  }

  return chunks;
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function loadInvoiceFontBytes() {
  fontBytesPromise ??= Promise.all([
    readFile(
      path.join(
        process.cwd(),
        "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
      ),
    ),
    readFile(
      path.join(
        process.cwd(),
        "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf",
      ),
    ),
  ]).then(([regular, semibold]) => ({ regular, semibold }));

  return fontBytesPromise;
}
