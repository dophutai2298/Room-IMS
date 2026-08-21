import assert from "node:assert/strict";
import test from "node:test";

import { buildInvoiceListFromJoinedRows } from "./presenter";

test("Invoice list preserves its public item shape when Room names come from joined rows", () => {
  const items = buildInvoiceListFromJoinedRows([
    {
      id: "invoice-1",
      room_id: "room-1",
      month: 8,
      year: 2026,
      room_fee: 3_000_000,
      electricity_fee: 350_000,
      water_fee: 170_000,
      other_fee: 0,
      other_fee_note: null,
      total_amount: 3_520_000,
      amount_paid: 1_000_000,
      status: "Partially Paid",
      room: { name: "A101" },
    },
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0]?.roomName, "A101");
  assert.equal(items[0]?.balanceDue, 2_520_000);
  assert.equal(items[0]?.periodLabel, "08/2026");
});
