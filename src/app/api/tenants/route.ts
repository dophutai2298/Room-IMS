import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { createInsForgeTenantRepository } from "@/lib/insforge/tenant-repository";
import { resolveOperationalAppUser } from "@/lib/server/operational-auth";
import { validateTenantWriteRequest } from "@/lib/tenants/api";
import {
  createTenantForOperations,
  listTenantsForOperations,
} from "@/lib/tenants/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const timer = createApiTimer("tenants.directory.list");

  try {
    const auth = await resolveOperationalAppUser({ timer });

    if (auth.error) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(auth.error, meta);
    }

    const search = new URL(request.url).searchParams.get("search");
    const repository = createInsForgeTenantRepository({ timer });
    const result = await timer.measure("service", () =>
      listTenantsForOperations({ repository, search }),
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

export async function POST(request: Request) {
  const timer = createApiTimer("tenants.directory.create");

  try {
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
