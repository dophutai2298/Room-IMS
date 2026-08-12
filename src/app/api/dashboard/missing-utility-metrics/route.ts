import { getDashboardBillingPeriodFromRequest } from "@/lib/dashboard/api";
import { getDashboardMissingUtilityMetricsForOperations } from "@/lib/dashboard/service";
import { createInsForgeDashboardRepository } from "@/lib/insforge/dashboard-repository";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "dashboard.missing-utility-metrics" },
  async ({ timer }, request: Request) => {
    const billingPeriod = getDashboardBillingPeriodFromRequest(request);
    const repository = createInsForgeDashboardRepository({ timer });
    return timer.measure("service", () =>
      getDashboardMissingUtilityMetricsForOperations({ repository, billingPeriod }),
    );
  },
);
