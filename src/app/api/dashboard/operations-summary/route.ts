import { getDashboardBillingPeriodFromRequest } from "@/lib/dashboard/api";
import { getDashboardOperationsSummaryForOperations } from "@/lib/dashboard/service";
import { createDashboardRepository } from "@/lib/backend/dashboard-repository";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "dashboard.operations-summary" },
  async ({ timer }, request: Request) => {
    const billingPeriod = getDashboardBillingPeriodFromRequest(request);
    const repository = createDashboardRepository({ timer });

    return timer.measure("service", () =>
      getDashboardOperationsSummaryForOperations({
        repository,
        billingPeriod,
      }),
    );
  },
);
