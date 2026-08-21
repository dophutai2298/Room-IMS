import type { ApiTimer } from "@/lib/api/timing";
import type { AuthenticatedRouteContext } from "@/lib/server/operational-route";
import { validateInvoiceGenerationRequest } from "./generation";
import type { InvoiceGenerationRepository } from "./generation-repository";
import { generateInvoiceForOperations } from "./generation-service";

export function createInvoiceGenerationHttpHandler({
  createRepository,
}: {
  createRepository: (input: { timer: ApiTimer }) => InvoiceGenerationRepository;
}) {
  return async (
    { timer }: AuthenticatedRouteContext,
    request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const { id } = await params;
    const validation = await timer.measure("validation", async () =>
      validateInvoiceGenerationRequest({
        roomId: id,
        body: await request.json().catch(() => null),
      }),
    );

    if (validation.error) {
      return validation.error;
    }

    const repository = createRepository({ timer });

    return timer.measure("service", () =>
      generateInvoiceForOperations({
        repository,
        ...validation.data,
      }),
    );
  };
}
