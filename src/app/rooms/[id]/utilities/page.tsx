import { UtilitiesClient } from "./utilities-client";
import { normalizeBillingPeriod } from "@/lib/utilities/presenter";

export default async function UtilitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const billingPeriod = normalizeBillingPeriod({
    month: query.month,
    year: query.year,
  });

  return <UtilitiesClient roomId={id} billingPeriod={billingPeriod} />;
}
