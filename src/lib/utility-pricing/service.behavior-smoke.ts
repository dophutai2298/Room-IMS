import "server-only";

import type { AppResult } from "@/lib/insforge/errors";
import type { UtilityPricingListItem } from "./presenter";
import type {
  CreateUtilityPricingInput,
  DeactivateUtilityPricingInput,
  UtilityPricingRepository,
} from "./repository";
import {
  createUtilityPricingForOperations,
  deactivateUtilityPricingForOperations,
  listUtilityPricingForOperations,
} from "./service";

export async function runUtilityPricingServiceBehaviorSmoke() {
  const repository = createSmokeRepository();

  return {
    listPricing: await listUtilityPricingForOperations({ repository }),
    createPricing: await createUtilityPricingForOperations({
      repository,
      effectiveFrom: "2026-09-01",
      electricityUnitPrice: 4_100,
      waterUnitPrice: 19_000,
    }),
    deactivatePricing: await deactivateUtilityPricingForOperations({
      repository,
      pricingId: activePricing.id,
    }),
    rejectMissingEffectiveFrom: await createUtilityPricingForOperations({
      repository,
      effectiveFrom: "",
      electricityUnitPrice: 4_100,
      waterUnitPrice: 19_000,
    }),
    rejectNegativeElectricityPrice: await createUtilityPricingForOperations({
      repository,
      effectiveFrom: "2026-09-01",
      electricityUnitPrice: -1,
      waterUnitPrice: 19_000,
    }),
  };
}

function createSmokeRepository(): UtilityPricingRepository {
  return {
    async listPricing() {
      return ok([activePricing, historicalPricing]);
    },
    async createPricing(input) {
      return ok(createPricingItem(input));
    },
    async deactivatePricing(input) {
      return ok(deactivatePricingItem(input));
    },
  };
}

const activePricing: UtilityPricingListItem = {
  id: "30000000-0000-0000-0000-000000000002",
  effectiveFrom: "2026-08-01",
  effectiveFromLabel: "01/08/2026",
  electricityUnitPrice: 3_900,
  waterUnitPrice: 18_000,
  isActive: true,
  statusLabel: "Đang áp dụng",
};

const historicalPricing: UtilityPricingListItem = {
  id: "30000000-0000-0000-0000-000000000001",
  effectiveFrom: "2026-07-01",
  effectiveFromLabel: "01/07/2026",
  electricityUnitPrice: 3_500,
  waterUnitPrice: 17_000,
  isActive: false,
  statusLabel: "Lịch sử",
};

function createPricingItem(input: CreateUtilityPricingInput): UtilityPricingListItem {
  return {
    id: "30000000-0000-0000-0000-000000000003",
    effectiveFrom: input.effectiveFrom,
    effectiveFromLabel: "01/09/2026",
    electricityUnitPrice: input.electricityUnitPrice,
    waterUnitPrice: input.waterUnitPrice,
    isActive: true,
    statusLabel: "Đang áp dụng",
  };
}

function deactivatePricingItem({
  pricingId,
}: DeactivateUtilityPricingInput): UtilityPricingListItem {
  return {
    ...activePricing,
    id: pricingId,
    isActive: false,
    statusLabel: "Lịch sử",
  };
}

function ok<T>(data: T): AppResult<T> {
  return {
    data,
    error: null,
  };
}
