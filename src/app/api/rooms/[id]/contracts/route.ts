import { validationApiError } from "@/lib/api/errors";
import { validateContractCreateRequest } from "@/lib/contracts/api";
import {
  createContractForOperations,
  listRoomContractsForOperations,
} from "@/lib/contracts/service";
import { createInsForgeContractRepository } from "@/lib/insforge/contract-repository";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "contracts.list" },
  async ({ timer }, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    if (!id) {
      return missingRoomIdError();
    }

    const repository = createInsForgeContractRepository({ timer });
    return timer.measure("service", () =>
      listRoomContractsForOperations({ repository, roomId: id }),
    );
  },
);

export const POST = withOperationalAuth(
  { operation: "contracts.create" },
  async ({ timer }, request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    if (!id) {
      return missingRoomIdError();
    }

    const validation = await timer.measure("validation", () =>
      validateContractCreateRequest(request),
    );

    if (validation.error) {
      return validation.error;
    }

    const repository = createInsForgeContractRepository({ timer });
    return timer.measure("service", () =>
      createContractForOperations({
        repository,
        roomId: id,
        ...validation.data,
      }),
    );
  },
);

function missingRoomIdError() {
  return validationApiError({
    message: "Room id is required.",
    details: { fieldErrors: { roomId: "Room id is required." } },
  });
}
