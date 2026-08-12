import { createInsForgeTenantRepository } from "@/lib/insforge/tenant-repository";
import { withOperationalAuth } from "@/lib/server/operational-route";
import { validateTenantWriteRequest } from "@/lib/tenants/api";
import {
  createTenantForOperations,
  listTenantsForOperations,
} from "@/lib/tenants/service";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "tenants.directory.list" },
  async ({ timer }, request: Request) => {
    const search = new URL(request.url).searchParams.get("search");
    const repository = createInsForgeTenantRepository({ timer });
    return timer.measure("service", () =>
      listTenantsForOperations({ repository, search }),
    );
  },
);

export const POST = withOperationalAuth(
  { operation: "tenants.directory.create" },
  async ({ timer }, request: Request) => {
    const validation = await timer.measure("validation", () =>
      validateTenantWriteRequest({ request }),
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
