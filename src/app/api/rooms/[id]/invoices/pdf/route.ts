import { createInvoiceExportRepository } from "@/lib/backend/billing-repositories";
import { createInvoicePdfExportRoute } from "@/lib/invoices/export-route";
import { renderInvoicePdf } from "@/lib/invoices/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createInvoicePdfExportRoute({
  createRepository: createInvoiceExportRepository,
  renderPdf: renderInvoicePdf,
});
