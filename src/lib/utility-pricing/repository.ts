import type { AppResult } from "@/lib/insforge/errors";
import type { UtilityPricingListItem } from "./presenter";

export type CreateUtilityPricingInput = {
  effectiveFrom: string;
  electricityUnitPrice: number;
  waterUnitPrice: number;
};

export type DeactivateUtilityPricingInput = {
  pricingId: string;
};

export type UtilityPricingRepository = {
  listPricing(): Promise<AppResult<UtilityPricingListItem[]>>;
  createPricing(
    input: CreateUtilityPricingInput,
  ): Promise<AppResult<UtilityPricingListItem>>;
  deactivatePricing(
    input: DeactivateUtilityPricingInput,
  ): Promise<AppResult<UtilityPricingListItem>>;
};
