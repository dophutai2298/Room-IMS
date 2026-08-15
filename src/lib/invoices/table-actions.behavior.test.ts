import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildInvoicePaymentEndpoint,
  buildInvoiceUtilityDetailHref,
} from "./table-actions";

describe("invoice table row actions", () => {
  it("keeps invoice detail and payment action targets stable", () => {
    const invoice = {
      id: "f0778fcc-b0d2-4cc3-bd84-d94a290fe53f",
      roomId: "00000000-0000-0000-0000-000000000101",
      billingPeriod: {
        month: 7,
        year: 2026,
      },
    };

    assert.equal(
      buildInvoiceUtilityDetailHref(invoice),
      "/rooms/00000000-0000-0000-0000-000000000101/utilities?month=7&year=2026",
    );
    assert.equal(
      buildInvoicePaymentEndpoint(invoice.id),
      "/api/invoices/f0778fcc-b0d2-4cc3-bd84-d94a290fe53f/payment",
    );
  });
});
