import type { AppResult } from "@/lib/insforge/errors";
import type { InvoiceRecord } from "@/lib/insforge/types";
import type { InvoiceListItem } from "./presenter";

export type InvoicePaymentTarget = {
  id: string;
  totalAmount: number;
};

export type RecordInvoicePaymentInput = {
  invoiceId: string;
  status: InvoiceRecord["status"];
  amountPaid: number | null;
};

export type PersistInvoicePaymentInput = {
  invoiceId: string;
  status: InvoiceRecord["status"];
  amountPaid: number;
};

export type InvoiceRepository = {
  listInvoiceItems(): Promise<AppResult<InvoiceListItem[]>>;
  findInvoicePaymentTarget(
    invoiceId: string,
  ): Promise<AppResult<InvoicePaymentTarget>>;
  updateInvoicePayment(
    input: PersistInvoicePaymentInput,
  ): Promise<AppResult<InvoiceListItem>>;
};
