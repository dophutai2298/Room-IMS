import { validationApiError } from "@/lib/api/errors";
import { validateContractUpdateRequest } from "@/lib/contracts/api";
import { updateContractForOperations } from "@/lib/contracts/service";
import { createInsForgeContractRepository } from "@/lib/insforge/contract-repository";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const PATCH = withOperationalAuth(
  { operation: "contracts.update" },
  async ({ timer }, request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    if (!id) {
      return validationApiError({
        message: "Contract id is required.",
        details: {
          fieldErrors: { contractId: "Contract id is required." },
        },
      });
    }

    const validation = await timer.measure("validation", () =>
      validateContractUpdateRequest(request),
    );

    if (validation.error) {
      return validation.error;
    }

    const repository = createInsForgeContractRepository({ timer });
    return timer.measure("service", () =>
      updateContractForOperations({
        repository,
        contractId: id,
        ...validation.data,
      }),
    );
  },
);
