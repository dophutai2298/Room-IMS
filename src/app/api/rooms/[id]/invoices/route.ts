import { createInsForgeInvoiceGenerationRepository } from "@/lib/insforge/invoice-generation-repository";
import { createInvoiceGenerationHttpHandler } from "@/lib/invoices/generation-http";
import { withOperationalAuth } from "@/lib/server/operational-route";
import { operationalCreateRoles } from "@/lib/server/role-policy";

export const dynamic = "force-dynamic";

const generateInvoice = createInvoiceGenerationHttpHandler({
  createRepository: createInsForgeInvoiceGenerationRepository,
});

export const POST = withOperationalAuth(
  {
    operation: "invoices.generate",
    allowedRoles: operationalCreateRoles,
  },
  generateInvoice,
);
