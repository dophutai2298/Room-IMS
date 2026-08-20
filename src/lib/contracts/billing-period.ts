import type { ContractRecord } from "@/lib/insforge/types";
import type { BillingPeriod } from "@/lib/utilities/presenter";

type ContractPeriod = Pick<ContractRecord, "end_date" | "start_date">;

export function resolveApplicableContract<TContract extends ContractPeriod>({
  contracts,
  billingPeriod,
}: {
  contracts: TContract[];
  billingPeriod: BillingPeriod;
}): TContract | undefined {
  const periodStart = new Date(
    Date.UTC(billingPeriod.year, billingPeriod.month - 1, 1),
  );
  const periodEnd = new Date(
    Date.UTC(billingPeriod.year, billingPeriod.month, 0),
  );

  return contracts
    .filter((contract) => {
      const startsOnOrBeforePeriodEnd = new Date(contract.start_date) <= periodEnd;
      const endsOnOrAfterPeriodStart =
        contract.end_date === null || new Date(contract.end_date) >= periodStart;

      return startsOnOrBeforePeriodEnd && endsOnOrAfterPeriodStart;
    })
    .sort(
      (left, right) =>
        new Date(right.start_date).getTime() -
        new Date(left.start_date).getTime(),
    )[0];
}
