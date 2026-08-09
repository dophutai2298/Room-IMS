import { validationApiError } from "@/lib/api/errors";
import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { createInsForgeTenantRepository } from "@/lib/insforge/tenant-repository";
import { resolveOperationalAppUser } from "@/lib/server/operational-auth";
import { validateTenantWriteRequest } from "@/lib/tenants/api";
import {
  getTenantForOperations,
  updateTenantForOperations,
} from "@/lib/tenants/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const timer = createApiTimer("tenants.detail");

  try {
    const { id } = await params;

    if (!id) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(
        validationApiError({
          message: "Tenant id is required.",
          details: { fieldErrors: { tenantId: "Tenant id is required." } },
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
      getTenantForOperations({ repository, tenantId: id }),
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const timer = createApiTimer("tenants.update");

  try {
    const { id } = await params;

    if (!id) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(
        validationApiError({
          message: "Tenant id is required.",
          details: { fieldErrors: { tenantId: "Tenant id is required." } },
        }),
        meta,
      );
    }

    const validation = await timer.measure("validation", () =>
      validateTenantWriteRequest({ request }),
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
      updateTenantForOperations({
        repository,
        tenantId: id,
        name: validation.data.name,
        phone: validation.data.phone,
        status: validation.data.status,
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
