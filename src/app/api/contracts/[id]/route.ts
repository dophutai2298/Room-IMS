import { validationApiError } from "@/lib/api/errors";
import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { validateContractUpdateRequest } from "@/lib/contracts/api";
import { updateContractForOperations } from "@/lib/contracts/service";
import { createInsForgeContractRepository } from "@/lib/insforge/contract-repository";
import { resolveOperationalAppUser } from "@/lib/server/operational-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const timer = createApiTimer("contracts.update");

  try {
    const { id } = await params;

    if (!id) {
      return respond(timer, () =>
        apiFailure(
          validationApiError({
            message: "Contract id is required.",
            details: {
              fieldErrors: { contractId: "Contract id is required." },
            },
          }),
          timingMeta(timer),
        ),
      );
    }

    const validation = await timer.measure("validation", () =>
      validateContractUpdateRequest(request),
    );

    if (validation.error) {
      return respond(timer, () =>
        apiFailure(validation.error, timingMeta(timer)),
      );
    }

    const auth = await resolveOperationalAppUser({ timer });

    if (auth.error) {
      return respond(timer, () => apiFailure(auth.error, timingMeta(timer)));
    }

    const repository = createInsForgeContractRepository({ timer });
    const result = await timer.measure("service", () =>
      updateContractForOperations({
        repository,
        contractId: id,
        ...validation.data,
      }),
    );

    return respond(timer, () => apiResult(result, timingMeta(timer)));
  } catch (error) {
    return respond(timer, () => apiException(error, timingMeta(timer)));
  }
}

function timingMeta(timer: ReturnType<typeof createApiTimer>) {
  return { timing: timer.snapshot() };
}

function respond(
  timer: ReturnType<typeof createApiTimer>,
  createResponse: () => Response,
) {
  const response = createResponse();
  logApiTiming(timer.snapshot());
  return response;
}
