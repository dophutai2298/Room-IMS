import type { InvoiceListItem } from "./presenter";

type InvoiceTableActionTarget = Pick<
  InvoiceListItem,
  "billingPeriod" | "id" | "roomId"
>;

export function buildInvoiceUtilityDetailHref(invoice: InvoiceTableActionTarget) {
  const { month, year } = invoice.billingPeriod;

  return `/rooms/${invoice.roomId}/utilities?month=${month}&year=${year}`;
}

export function buildInvoicePaymentEndpoint(invoiceId: string) {
  return `/api/invoices/${invoiceId}/payment`;
}
