import type { AppResult } from "@/lib/insforge/errors";
import type { InvoiceRecord } from "@/lib/insforge/types";
import type { GenerateInvoiceInput } from "./generation";

export type InvoiceGenerationRepository = {
  generateInvoice(
    input: GenerateInvoiceInput,
  ): Promise<AppResult<InvoiceRecord>>;
};
