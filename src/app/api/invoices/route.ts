import { createInvoiceRepository } from "@/lib/backend/billing-repositories";
import { listInvoicesForOperations } from "@/lib/invoices/service";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "invoices.list" },
  async ({ timer }) => {
    const repository = createInvoiceRepository({ timer });
    return timer.measure("service", () =>
      listInvoicesForOperations({ repository }),
    );
  },
);
