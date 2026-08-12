import { validationApiError } from "@/lib/api/errors";
import { createInsForgeTenantRepository } from "@/lib/insforge/tenant-repository";
import { withOperationalAuth } from "@/lib/server/operational-route";
import { validateTenantWriteRequest } from "@/lib/tenants/api";
import {
  createTenantForOperations,
  listRoomTenantsForOperations,
} from "@/lib/tenants/service";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "tenants.list" },
  async ({ timer }, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    if (!id) {
      return validationApiError({
        message: "Room id is required.",
        details: { fieldErrors: { roomId: "Room id is required." } },
      });
    }

    const repository = createInsForgeTenantRepository({ timer });
    return timer.measure("service", () =>
      listRoomTenantsForOperations({ repository, roomId: id }),
    );
  },
);

export const POST = withOperationalAuth(
  { operation: "tenants.create" },
  async ({ timer }, request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const validation = await timer.measure("validation", () =>
      validateTenantWriteRequest({ request, roomId: id }),
    );

    if (validation.error) {
      return validation.error;
    }

    const repository = createInsForgeTenantRepository({ timer });
    return timer.measure("service", () =>
      createTenantForOperations({
        repository,
        ...validation.data,
      }),
    );
  },
);
