import { DashboardClient } from "./dashboard-client";
import { getDefaultBillingPeriod } from "@/lib/utilities/presenter";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  return <DashboardClient billingPeriod={getDefaultBillingPeriod()} />;
}
