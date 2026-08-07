import "server-only";

import {
  getDefaultBillingPeriod,
  normalizeBillingPeriod,
} from "@/lib/utilities/presenter";

export function getDashboardBillingPeriodFromRequest(request: Request) {
  const url = new URL(request.url);

  return normalizeBillingPeriod({
    month: url.searchParams.get("month") ?? undefined,
    year: url.searchParams.get("year") ?? undefined,
    fallback: getDefaultBillingPeriod(),
  });
}
