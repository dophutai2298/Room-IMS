import assert from "node:assert/strict";
import test from "node:test";

import { appError } from "@/lib/insforge/errors";
import { getInvoiceExportForOperations } from "./export-service";
import type { InvoiceExportRepository } from "./export-repository";

test("invoice export reports a standard not-found result when the selected room period has no invoice", async () => {
  const repository: InvoiceExportRepository = {
    async findInvoiceExportSource() {
      return appError({
        code: "INVOICE_NOT_FOUND",
        message: "Invoice was not found for the selected room and billing period.",
        statusCode: 404,
      });
    },
  };

  const result = await getInvoiceExportForOperations({
    repository,
    roomId: "00000000-0000-0000-0000-000000000101",
    billingPeriod: { month: 7, year: 2026 },
    exportedAt: new Date("2026-08-20T03:00:00.000Z"),
  });

  assert.equal(result.data, null);
  assert.deepEqual(result.error, {
    code: "INVOICE_NOT_FOUND",
    message: "Invoice was not found for the selected room and billing period.",
    statusCode: 404,
    nextActions: undefined,
  });
});
