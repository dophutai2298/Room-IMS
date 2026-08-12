import { createInsForgeInvoiceRepository } from "@/lib/insforge/invoice-repository";
import { listInvoicesForOperations } from "@/lib/invoices/service";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "invoices.list" },
  async ({ timer }) => {
    const repository = createInsForgeInvoiceRepository({ timer });
    return timer.measure("service", () =>
      listInvoicesForOperations({ repository }),
    );
  },
);
