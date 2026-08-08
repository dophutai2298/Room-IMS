import "server-only";

import { appError, type AppResult } from "@/lib/insforge/errors";
import type {
  CreateUtilityPricingInput,
  DeactivateUtilityPricingInput,
  UtilityPricingRepository,
} from "./repository";
import type { UtilityPricingListItem } from "./presenter";

export async function listUtilityPricingForOperations({
  repository,
}: {
  repository: UtilityPricingRepository;
}): Promise<AppResult<UtilityPricingListItem[]>> {
  return repository.listPricing();
}

export async function createUtilityPricingForOperations({
  repository,
  effectiveFrom,
  electricityUnitPrice,
  waterUnitPrice,
}: CreateUtilityPricingInput & {
  repository: UtilityPricingRepository;
}): Promise<AppResult<UtilityPricingListItem>> {
  const validation = validateUtilityPricingWrite({
    effectiveFrom,
    electricityUnitPrice,
    waterUnitPrice,
  });

  if (validation.error) {
    return validation;
  }

  return repository.createPricing(validation.data);
}

export async function deactivateUtilityPricingForOperations({
  repository,
  pricingId,
}: DeactivateUtilityPricingInput & {
  repository: UtilityPricingRepository;
}): Promise<AppResult<UtilityPricingListItem>> {
  if (!pricingId.trim()) {
    return appError({
      message: "Utility Pricing id is required.",
      code: "UTILITY_PRICING_ID_REQUIRED",
      statusCode: 422,
    });
  }

  return repository.deactivatePricing({ pricingId });
}

function validateUtilityPricingWrite(
  input: CreateUtilityPricingInput,
): AppResult<CreateUtilityPricingInput> {
  const effectiveFrom = input.effectiveFrom.trim();

  if (!isValidDateInput(effectiveFrom)) {
    return appError({
      message: "Effective date is required.",
      code: "UTILITY_PRICING_EFFECTIVE_FROM_REQUIRED",
      statusCode: 422,
    });
  }

  if (!isNonNegativeMoney(input.electricityUnitPrice)) {
    return appError({
      message: "Electricity unit price must be a non-negative number.",
      code: "UTILITY_PRICING_ELECTRICITY_PRICE_INVALID",
      statusCode: 422,
    });
  }

  if (!isNonNegativeMoney(input.waterUnitPrice)) {
    return appError({
      message: "Water unit price must be a non-negative number.",
      code: "UTILITY_PRICING_WATER_PRICE_INVALID",
      statusCode: 422,
    });
  }

  return {
    data: {
      effectiveFrom,
      electricityUnitPrice: roundMoney(input.electricityUnitPrice),
      waterUnitPrice: roundMoney(input.waterUnitPrice),
    },
    error: null,
  };
}

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return Number.isFinite(parsed.getTime());
}

function isNonNegativeMoney(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
