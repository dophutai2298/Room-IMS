import {
  getDashboardBillingPeriodFromRequest,
  getDashboardRevenueRangeFromRequest,
} from "@/lib/dashboard/api";
import { getDashboardRevenueForOperations } from "@/lib/dashboard/service";
import { createDashboardRepository } from "@/lib/backend/dashboard-repository";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "dashboard.revenue" },
  async ({ timer }, request: Request) => {
    const billingPeriod = getDashboardBillingPeriodFromRequest(request);
    const chartRange = getDashboardRevenueRangeFromRequest(request);
    const repository = createDashboardRepository({ timer });
    return timer.measure("service", () =>
      getDashboardRevenueForOperations({
        repository,
        billingPeriod,
        chartRange,
      }),
    );
  },
);
