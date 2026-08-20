import "server-only";

import { ok, type AppResult } from "@/lib/insforge/errors";
import { buildInvoiceExportView, type InvoiceExportView } from "./export";
import type {
  InvoiceExportRepository,
  InvoiceExportTarget,
} from "./export-repository";

export async function getInvoiceExportForOperations({
  repository,
  roomId,
  billingPeriod,
  exportedAt,
}: InvoiceExportTarget & {
  repository: InvoiceExportRepository;
  exportedAt: Date;
}): Promise<AppResult<InvoiceExportView>> {
  const source = await repository.findInvoiceExportSource({
    roomId,
    billingPeriod,
  });

  if (source.error) {
    return source;
  }

  return ok(
    buildInvoiceExportView({
      ...source.data,
      exportedAt,
    }),
  );
}
