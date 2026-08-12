import { validationApiError } from "@/lib/api/errors";
import { createInsForgeTenantRepository } from "@/lib/insforge/tenant-repository";
import { withOperationalAuth } from "@/lib/server/operational-route";
import { validateTenantCccdUploadRequest } from "@/lib/tenants/api";
import { uploadTenantCccdImagesForOperations } from "@/lib/tenants/service";

export const dynamic = "force-dynamic";

export const POST = withOperationalAuth(
  { operation: "tenants.cccd-images.upload" },
  async ({ timer }, request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    if (!id) {
      return validationApiError({
        message: "Tenant id is required.",
        details: { fieldErrors: { tenantId: "Tenant id is required." } },
      });
    }

    const validation = await timer.measure("validation", () =>
      validateTenantCccdUploadRequest(request),
    );

    if (validation.error) {
      return validation.error;
    }

    const repository = createInsForgeTenantRepository({ timer });
    return timer.measure("service", () =>
      uploadTenantCccdImagesForOperations({
        repository,
        tenantId: id,
        images: validation.data.images,
      }),
    );
  },
);
