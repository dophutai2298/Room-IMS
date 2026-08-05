import type { ApiResponse } from "@/lib/api/response";
import type { InvoiceListItem } from "./presenter";

const authenticatedInvoiceListApiSmoke = {
  ok: true,
  data: [
    {
      id: "00000000-0000-0000-0000-000000000501",
      shortId: "INV-2607-00000000",
      roomId: "00000000-0000-0000-0000-000000000101",
      roomName: "P101",
      billingPeriod: {
        month: 7,
        year: 2026,
      },
      periodLabel: "07/2026",
      roomFee: 2500000,
      electricityFee: 350000,
      waterFee: 170000,
      otherFee: 0,
      utilityFee: 520000,
      totalAmount: 3020000,
      amountPaid: 0,
      balanceDue: 3020000,
      status: "Unpaid",
    },
  ],
  meta: {
    timing: {
      operation: "invoices.list",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.invoices-list", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<InvoiceListItem[]>;

export function getAuthenticatedInvoiceListApiSmokeResponse() {
  return authenticatedInvoiceListApiSmoke;
}
