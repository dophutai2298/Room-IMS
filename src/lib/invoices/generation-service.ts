import "server-only";

import type { GenerateInvoiceInput } from "./generation";
import type { InvoiceGenerationRepository } from "./generation-repository";

export async function generateInvoiceForOperations({
  repository,
  ...input
}: GenerateInvoiceInput & {
  repository: InvoiceGenerationRepository;
}) {
  return repository.generateInvoice(input);
}
