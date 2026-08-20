import { createInsForgeInvoiceExportRepository } from "@/lib/insforge/invoice-export-repository";
import { createInvoicePdfExportRoute } from "@/lib/invoices/export-route";
import { renderInvoicePdf } from "@/lib/invoices/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createInvoicePdfExportRoute({
  createRepository: createInsForgeInvoiceExportRepository,
  renderPdf: renderInvoicePdf,
});
