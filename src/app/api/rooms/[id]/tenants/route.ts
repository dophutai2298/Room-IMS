import { validationApiError } from "@/lib/api/errors";
import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { createInsForgeTenantRepository } from "@/lib/insforge/tenant-repository";
import { resolveOperationalAppUser } from "@/lib/server/operational-auth";
import { validateTenantWriteRequest } from "@/lib/tenants/api";
import {
  createTenantForOperations,
  listRoomTenantsForOperations,
} from "@/lib/tenants/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const timer = createApiTimer("tenants.list");

  try {
    const { id } = await params;

    if (!id) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(
        validationApiError({
          message: "Room id is required.",
          details: { fieldErrors: { roomId: "Room id is required." } },
        }),
        meta,
      );
    }

    const auth = await resolveOperationalAppUser({ timer });

    if (auth.error) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(auth.error, meta);
    }

    const repository = createInsForgeTenantRepository({ timer });
    const result = await timer.measure("service", () =>
      listRoomTenantsForOperations({ repository, roomId: id }),
    );
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);

    return apiResult(result, meta);
  } catch (error) {
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);

    return apiException(error, meta);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const timer = createApiTimer("tenants.create");

  try {
    const { id } = await params;
    const validation = await timer.measure("validation", () =>
      validateTenantWriteRequest({ request, roomId: id }),
    );

    if (validation.error) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(validation.error, meta);
    }

    const auth = await resolveOperationalAppUser({ timer });

    if (auth.error) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(auth.error, meta);
    }

    const repository = createInsForgeTenantRepository({ timer });
    const result = await timer.measure("service", () =>
      createTenantForOperations({
        repository,
        ...validation.data,
      }),
    );
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);

    return apiResult(result, meta);
  } catch (error) {
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);

    return apiException(error, meta);
  }
}
