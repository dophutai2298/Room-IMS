import { createInvoiceGenerationRepository } from "@/lib/backend/billing-repositories";
import { createInvoiceGenerationHttpHandler } from "@/lib/invoices/generation-http";
import { withOperationalAuth } from "@/lib/server/operational-route";
import { operationalCreateRoles } from "@/lib/server/role-policy";

export const dynamic = "force-dynamic";

const generateInvoice = createInvoiceGenerationHttpHandler({
  createRepository: createInvoiceGenerationRepository,
});

export const POST = withOperationalAuth(
  {
    operation: "invoices.generate",
    allowedRoles: operationalCreateRoles,
  },
  generateInvoice,
);
