import type { AppResult } from "@/lib/insforge/errors";
import type { InvoiceListItem } from "./presenter";

export type InvoiceListRepository = {
  listInvoiceItems(): Promise<AppResult<InvoiceListItem[]>>;
};
