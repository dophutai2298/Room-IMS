import { validationApiError } from "@/lib/api/errors";
import { createInsForgeTenantRepository } from "@/lib/insforge/tenant-repository";
import {
  existingDataMutationForbiddenMessage,
  landlordOnlyRoles,
} from "@/lib/server/role-policy";
import { withOperationalAuth } from "@/lib/server/operational-route";
import { deleteTenantCccdImageForOperations } from "@/lib/tenants/service";

export const dynamic = "force-dynamic";

export const DELETE = withOperationalAuth(
  {
    operation: "tenants.cccd-images.delete",
    allowedRoles: landlordOnlyRoles,
    forbiddenMessage: existingDataMutationForbiddenMessage,
  },
  async (
    { timer },
    _request: Request,
    { params }: { params: Promise<{ id: string; imageId: string }> },
  ) => {
    const { id, imageId } = await params;

    if (!id || !imageId) {
      return validationApiError({
        message: "Tenant id and CCCD image id are required.",
        details: {
          fieldErrors: {
            tenantId: !id ? "Tenant id is required." : undefined,
            imageId: !imageId ? "Tenant CCCD image id is required." : undefined,
          },
        },
      });
    }

    const repository = createInsForgeTenantRepository({ timer });
    return timer.measure("service", () =>
      deleteTenantCccdImageForOperations({
        repository,
        tenantId: id,
        imageId,
      }),
    );
  },
);
