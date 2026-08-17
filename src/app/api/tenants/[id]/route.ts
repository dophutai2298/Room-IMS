import { validationApiError } from "@/lib/api/errors";
import { createInsForgeTenantRepository } from "@/lib/insforge/tenant-repository";
import {
  existingDataMutationForbiddenMessage,
  landlordOnlyRoles,
} from "@/lib/server/role-policy";
import { withOperationalAuth } from "@/lib/server/operational-route";
import { validateTenantWriteRequest } from "@/lib/tenants/api";
import {
  deleteTenantForOperations,
  getTenantForOperations,
  updateTenantForOperations,
} from "@/lib/tenants/service";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "tenants.detail" },
  async ({ timer }, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    if (!id) {
      return tenantIdRequiredError();
    }

    const repository = createInsForgeTenantRepository({ timer });
    return timer.measure("service", () =>
      getTenantForOperations({ repository, tenantId: id }),
    );
  },
);

export const PATCH = withOperationalAuth(
  {
    operation: "tenants.update",
    allowedRoles: landlordOnlyRoles,
    forbiddenMessage: existingDataMutationForbiddenMessage,
  },
  async ({ timer }, request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    if (!id) {
      return tenantIdRequiredError();
    }

    const validation = await timer.measure("validation", () =>
      validateTenantWriteRequest({ request }),
    );

    if (validation.error) {
      return validation.error;
    }

    const repository = createInsForgeTenantRepository({ timer });
    return timer.measure("service", () =>
      updateTenantForOperations({
        repository,
        tenantId: id,
        ...validation.data,
      }),
    );
  },
);

export const DELETE = withOperationalAuth(
  {
    operation: "tenants.delete",
    allowedRoles: landlordOnlyRoles,
    forbiddenMessage: existingDataMutationForbiddenMessage,
  },
  async ({ timer }, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    if (!id) {
      return tenantIdRequiredError();
    }

    const repository = createInsForgeTenantRepository({ timer });
    return timer.measure("service", () =>
      deleteTenantForOperations({ repository, tenantId: id }),
    );
  },
);

function tenantIdRequiredError() {
  return validationApiError({
    message: "Tenant id is required.",
    details: { fieldErrors: { tenantId: "Tenant id is required." } },
  });
}
