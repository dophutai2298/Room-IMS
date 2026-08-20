import assert from "node:assert/strict";
import test from "node:test";

import type {
  InvoiceRecord,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
} from "@/lib/insforge/types";
import { buildInvoiceExportView } from "./export";

const invoice: InvoiceRecord = {
  id: "00000000-0000-0000-0000-000000000501",
  room_id: "00000000-0000-0000-0000-000000000101",
  month: 7,
  year: 2026,
  room_fee: 2_500_000,
  electricity_fee: 350_000,
  water_fee: 170_000,
  other_fee: 50_000,
  other_fee_note: "Phụ thu vệ sinh",
  total_amount: 3_070_000,
  amount_paid: 1_000_000,
  status: "Partially Paid",
};

const room: RoomRecord = {
  id: invoice.room_id,
  name: "Phòng 101",
  status: "Occupied",
  base_price: 2_500_000,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const keyTenant: TenantRecord = {
  id: "10000000-0000-0000-0000-000000000001",
  room_id: room.id,
  full_name: "Nguyễn Minh Khoa",
  phone: "0908421739",
  cccd_number: "079000000001",
  cccd_front_url: "https://sensitive.example/cccd-front.jpg",
  cccd_back_url: "https://sensitive.example/cccd-back.jpg",
  is_key_tenant: true,
  status: "Active",
};

const utilityMetric: UtilityMetricRecord = {
  id: "20000000-0000-0000-0000-000000000001",
  room_id: room.id,
  month: invoice.month,
  year: invoice.year,
  electricity_old: 1_200,
  electricity_new: 1_300,
  water_old: 80,
  water_new: 90,
};

test("invoice export view contains the customer-facing monthly invoice without sensitive tenant data", () => {
  const view = buildInvoiceExportView({
    invoice,
    room,
    keyTenant,
    utilityMetric,
    exportedAt: new Date("2026-08-20T03:00:00.000Z"),
  });

  assert.deepEqual(view, {
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
  });

  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes(keyTenant.cccd_number ?? ""), false);
  assert.equal(serialized.includes(keyTenant.cccd_front_url ?? ""), false);
  assert.equal(serialized.includes(keyTenant.cccd_back_url ?? ""), false);
  assert.equal(serialized.includes("authUserId"), false);
  assert.equal(serialized.includes("timing"), false);
});
