import "client-only";

import type { Column } from "write-excel-file/browser";

import {
  INVOICE_EXCEL_COLUMNS,
  buildInvoiceExcelRows,
  type InvoiceExcelRow,
} from "./excel-export";
import type { InvoiceListItem } from "./presenter";

const MONEY_FORMAT = '#,##0 "₫"';

export async function downloadInvoiceExcel({
  filename,
  invoices,
}: {
  filename: string;
  invoices: InvoiceListItem[];
}) {
  if (invoices.length === 0) {
    throw new Error("Không có hóa đơn phù hợp để xuất Excel.");
  }

  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const rows = buildInvoiceExcelRows(invoices);

  await writeExcelFile(rows, {
    columns: buildWorkbookColumns(),
    sheet: "Hóa đơn",
    stickyRowsCount: 1,
  }).toFile(filename);
}

function buildWorkbookColumns(): Column<InvoiceExcelRow>[] {
  return INVOICE_EXCEL_COLUMNS.map((column) => ({
    header: {
      value: column.header,
      fontWeight: "bold",
      backgroundColor: "#DCE8FF",
      textColor: "#173B70",
      align: "center",
      verticalAlign: "center",
    },
    width: column.width,
    cell: (row) => {
      const value = row[column.key];

      if (column.kind === "money") {
        return {
          value: Number(value),
          type: Number,
          format: MONEY_FORMAT,
          align: "right",
        };
      }

      return {
        value: String(value),
        type: String,
        format: "@",
        wrap: column.key === "otherFeeNote",
      };
    },
  }));
}
