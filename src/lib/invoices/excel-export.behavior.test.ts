import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  INVOICE_EXCEL_COLUMNS,
  buildInvoiceExcelFilename,
  buildInvoiceExcelRows,
} from "./excel-export";
import type { InvoiceListItem } from "./presenter";

describe("invoice table Excel export", () => {
  it("builds customer-safe rows in current table order with numeric money values", () => {
    const rows = buildInvoiceExcelRows([
      createInvoice({
        shortId: "INV-2607-BBBBBBBB",
        roomName: "Phòng B",
        otherFee: 51_000,
        otherFeeNote: "Phí vệ sinh",
        totalAmount: 3_147_000,
        status: "Partially Paid",
        amountPaid: 1_000_000,
        balanceDue: 2_147_000,
      }),
      createInvoice({
        shortId: "INV-2607-AAAAAAAA",
        roomName: "Phòng A",
        status: "Paid",
        amountPaid: 3_096_000,
      }),
    ]);

    assert.deepEqual(
      INVOICE_EXCEL_COLUMNS.map((column) => column.header),
      [
        "Mã hóa đơn",
        "Kỳ thu",
        "Phòng",
        "Tiền thuê",
        "Tiền điện",
        "Tiền nước",
        "Phí khác",
        "Ghi chú phí khác",
        "Tổng tiền",
        "Đã thu",
        "Còn lại",
        "Trạng thái thanh toán",
      ],
    );
    assert.deepEqual(
      rows.map((row) => row.invoiceCode),
      ["INV-2607-BBBBBBBB", "INV-2607-AAAAAAAA"],
    );
    assert.equal(rows[0].roomFee, 2_800_000);
    assert.equal(rows[0].electricityFee, 245_000);
    assert.equal(rows[0].waterFee, 51_000);
    assert.equal(rows[0].otherFee, 51_000);
    assert.equal(rows[0].otherFeeNote, "Phí vệ sinh");
    assert.equal(rows[0].totalAmount, 3_147_000);
    assert.equal(rows[0].amountPaid, 1_000_000);
    assert.equal(rows[0].balanceDue, 2_147_000);
    assert.equal(rows[0].paymentStatus, "Thanh toán một phần");
    assert.equal(rows[1].otherFeeNote, "");
    assert.equal(rows[1].paymentStatus, "Đã thanh toán");
    assert.equal("actions" in rows[0], false);
  });

  it("builds a readable filename from the active period, status, and search", () => {
    assert.equal(
      buildInvoiceExcelFilename({
        periodKey: "2026-07",
        paymentStatus: "Partially Paid",
        searchText: "Phòng A/01",
        exportedAt: new Date("2026-08-20T08:00:00.000Z"),
      }),
      "hoa-don_2026-07_thanh-toan-mot-phan_phong-a-01_2026-08-20.xlsx",
    );

    assert.equal(
      buildInvoiceExcelFilename({
        periodKey: "all",
        paymentStatus: null,
        searchText: "",
        exportedAt: new Date("2026-08-20T08:00:00.000Z"),
      }),
      "hoa-don_tat-ca-ky_tat-ca-trang-thai_2026-08-20.xlsx",
    );
  });
});

function createInvoice(
  overrides: Partial<InvoiceListItem> = {},
): InvoiceListItem {
  const totalAmount = overrides.totalAmount ?? 3_096_000;
  const amountPaid = overrides.amountPaid ?? 0;

  return {
    id: "f0778fcc-b0d2-4cc3-bd84-d94a290fe53f",
    shortId: "INV-2607-F0778FCC",
    roomId: "00000000-0000-0000-0000-000000000101",
    roomName: "Phòng 101",
    billingPeriod: { month: 7, year: 2026 },
    periodLabel: "07/2026",
    roomFee: 2_800_000,
    electricityFee: 245_000,
    waterFee: 51_000,
    otherFee: 0,
    otherFeeNote: null,
    utilityFee: 296_000,
    totalAmount,
    amountPaid,
    balanceDue: Math.max(totalAmount - amountPaid, 0),
    status: "Unpaid",
    ...overrides,
  };
}
