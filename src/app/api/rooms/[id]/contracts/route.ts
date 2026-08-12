import { validationApiError } from "@/lib/api/errors";
import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { validateContractCreateRequest } from "@/lib/contracts/api";
import {
  createContractForOperations,
  listRoomContractsForOperations,
} from "@/lib/contracts/service";
import { createInsForgeContractRepository } from "@/lib/insforge/contract-repository";
import { resolveOperationalAppUser } from "@/lib/server/operational-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const timer = createApiTimer("contracts.list");

  try {
    const { id } = await params;

    if (!id) {
      return respondWithMissingRoomId(timer);
    }

    const auth = await resolveOperationalAppUser({ timer });

    if (auth.error) {
      return respond(timer, () => apiFailure(auth.error, timingMeta(timer)));
    }

    const repository = createInsForgeContractRepository({ timer });
    const result = await timer.measure("service", () =>
      listRoomContractsForOperations({ repository, roomId: id }),
    );

    return respond(timer, () => apiResult(result, timingMeta(timer)));
  } catch (error) {
    return respond(timer, () => apiException(error, timingMeta(timer)));
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const timer = createApiTimer("contracts.create");

  try {
    const { id } = await params;

    if (!id) {
      return respondWithMissingRoomId(timer);
    }

    const validation = await timer.measure("validation", () =>
      validateContractCreateRequest(request),
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
      createContractForOperations({
        repository,
        roomId: id,
        ...validation.data,
      }),
    );

    return respond(timer, () => apiResult(result, timingMeta(timer)));
  } catch (error) {
    return respond(timer, () => apiException(error, timingMeta(timer)));
  }
}

function respondWithMissingRoomId(timer: ReturnType<typeof createApiTimer>) {
  return respond(timer, () =>
    apiFailure(
      validationApiError({
        message: "Room id is required.",
        details: { fieldErrors: { roomId: "Room id is required." } },
      }),
      timingMeta(timer),
    ),
  );
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
