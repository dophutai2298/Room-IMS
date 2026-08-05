import "server-only";

import type { AppResult } from "@/lib/insforge/errors";
import type { InvoiceListItem } from "./presenter";
import type { InvoiceListRepository } from "./repository";

export async function listInvoicesForOperations({
  repository,
}: {
  repository: InvoiceListRepository;
}): Promise<AppResult<InvoiceListItem[]>> {
  return repository.listInvoiceItems();
}
