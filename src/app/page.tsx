import { DashboardClient } from "./dashboard-client";
import { getDefaultBillingPeriod } from "@/lib/utilities/presenter";

export default function Dashboard() {
  return <DashboardClient billingPeriod={getDefaultBillingPeriod()} />;
}
