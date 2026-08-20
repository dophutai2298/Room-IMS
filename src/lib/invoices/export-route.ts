import "server-only";

import type { ApiTimer, ApiTimingSnapshot } from "@/lib/api/timing";
import type { OperationalAuthResult } from "@/lib/server/operational-auth-core";
import { withOperationalAuth } from "@/lib/server/operational-route";
import { operationalReadRoles } from "@/lib/server/role-policy";
import type { InvoiceExportView } from "./export";
import {
  createInvoicePdfDownloadResponse,
  parseInvoicePdfExportTarget,
  type InvoicePdfBytes,
} from "./export-http";
import type { InvoiceExportRepository } from "./export-repository";
import { getInvoiceExportForOperations } from "./export-service";

type InvoicePdfRouteDependencies = {
  createRepository(input: { timer: ApiTimer }): InvoiceExportRepository;
  renderPdf(view: InvoiceExportView): Promise<InvoicePdfBytes>;
  now?: () => Date;
  resolveAuth?: (input: { timer: ApiTimer }) => Promise<OperationalAuthResult>;
  logTiming?: (snapshot: ApiTimingSnapshot) => void;
};

export function createInvoicePdfExportRoute({
  createRepository,
  renderPdf,
  now = () => new Date(),
  resolveAuth,
  logTiming,
}: InvoicePdfRouteDependencies) {
  return withOperationalAuth(
    {
      operation: "invoices.pdf.export",
      allowedRoles: operationalReadRoles,
      ...(resolveAuth ? { resolveAuth } : {}),
      ...(logTiming ? { logTiming } : {}),
    },
    async (
      { timer },
      request: Request,
      { params }: { params: Promise<{ id: string }> },
    ) => {
      const { id } = await params;
      const url = new URL(request.url);
      const target = await timer.measure("validation", async () =>
        parseInvoicePdfExportTarget({
          roomId: id,
          month: url.searchParams.get("month"),
          year: url.searchParams.get("year"),
        }),
      );

      if (target.error) {
        return target.error;
      }

      const repository = createRepository({ timer });
      const result = await timer.measure("service", () =>
        getInvoiceExportForOperations({
          repository,
          ...target.data,
          exportedAt: now(),
        }),
      );

      if (result.error) {
        return result;
      }

      const pdfBytes = await timer.measure("pdf.render", () =>
        renderPdf(result.data),
      );

      return createInvoicePdfDownloadResponse({
        view: result.data,
        pdfBytes,
      });
    },
  );
}
