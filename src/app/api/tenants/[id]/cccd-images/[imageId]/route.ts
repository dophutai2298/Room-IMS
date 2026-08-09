import { validationApiError } from "@/lib/api/errors";
import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { createInsForgeTenantRepository } from "@/lib/insforge/tenant-repository";
import { resolveOperationalAppUser } from "@/lib/server/operational-auth";
import { deleteTenantCccdImageForOperations } from "@/lib/tenants/service";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  const timer = createApiTimer("tenants.cccd-images.delete");

  try {
    const { id, imageId } = await params;

    if (!id || !imageId) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(
        validationApiError({
          message: "Tenant id and CCCD image id are required.",
          details: {
            fieldErrors: {
              tenantId: !id ? "Tenant id is required." : undefined,
              imageId: !imageId ? "Tenant CCCD image id is required." : undefined,
            },
          },
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
      deleteTenantCccdImageForOperations({
        repository,
        tenantId: id,
        imageId,
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
