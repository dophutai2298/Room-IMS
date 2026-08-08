import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { getDashboardBillingPeriodFromRequest } from "@/lib/dashboard/api";
import { getDashboardRevenueForOperations } from "@/lib/dashboard/service";
import { createInsForgeDashboardRepository } from "@/lib/insforge/dashboard-repository";
import { resolveOperationalAppUser } from "@/lib/server/operational-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const timer = createApiTimer("dashboard.revenue");

  try {
    const billingPeriod = getDashboardBillingPeriodFromRequest(request);
    const auth = await resolveOperationalAppUser({ timer });

    if (auth.error) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(auth.error, meta);
    }

    const repository = createInsForgeDashboardRepository({ timer });
    const result = await timer.measure("service", () =>
      getDashboardRevenueForOperations({ repository, billingPeriod }),
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
