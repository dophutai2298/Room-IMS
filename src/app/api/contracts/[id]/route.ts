import { validationApiError } from "@/lib/api/errors";
import { validateContractUpdateRequest } from "@/lib/contracts/api";
import { deleteContractForOperations, updateContractForOperations } from "@/lib/contracts/service";
import { createContractRepository } from "@/lib/backend/contract-repository";
import {
  existingDataMutationForbiddenMessage,
  landlordOnlyRoles,
} from "@/lib/server/role-policy";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const DELETE = withOperationalAuth(
  { operation: "contracts.delete", allowedRoles: landlordOnlyRoles,
    forbiddenMessage: existingDataMutationForbiddenMessage },
  async ({ timer }, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const repository = createContractRepository({ timer });
    return timer.measure("service", () => deleteContractForOperations({ repository, contractId: id }));
  },
);

export const PATCH = withOperationalAuth(
  {
    operation: "contracts.update",
    allowedRoles: landlordOnlyRoles,
    forbiddenMessage: existingDataMutationForbiddenMessage,
  },
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

    const repository = createContractRepository({ timer });
    return timer.measure("service", () =>
      updateContractForOperations({
        repository,
        contractId: id,
        ...validation.data,
      }),
    );
  },
);
