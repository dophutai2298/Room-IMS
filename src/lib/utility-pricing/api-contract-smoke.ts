import type { ApiResponse } from "@/lib/api/response";
import type { UtilityPricingListItem } from "./presenter";

const authenticatedUtilityPricingListApiSmoke = {
  ok: true,
  data: [
    {
      id: "30000000-0000-0000-0000-000000000002",
      effectiveFrom: "2026-08-01",
      effectiveFromLabel: "01/08/2026",
      electricityUnitPrice: 3900,
      waterUnitPrice: 18000,
      isActive: true,
      statusLabel: "Đang áp dụng",
    },
    {
      id: "30000000-0000-0000-0000-000000000001",
      effectiveFrom: "2026-07-01",
      effectiveFromLabel: "01/07/2026",
      electricityUnitPrice: 3500,
      waterUnitPrice: 17000,
      isActive: false,
      statusLabel: "Lịch sử",
    },
  ],
  meta: {
    timing: {
      operation: "utility-pricing.list",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.utility-pricing-list", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<UtilityPricingListItem[]>;

const authenticatedUtilityPricingCreateApiSmoke = {
  ok: true,
  data: {
    id: "30000000-0000-0000-0000-000000000003",
    effectiveFrom: "2026-09-01",
    effectiveFromLabel: "01/09/2026",
    electricityUnitPrice: 4100,
    waterUnitPrice: 19000,
    isActive: true,
    statusLabel: "Đang áp dụng",
  },
  meta: {
    timing: {
      operation: "utility-pricing.create",
      totalMs: 1,
      spans: [
        { name: "validation", durationMs: 1 },
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.utility-pricing-create", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<UtilityPricingListItem>;

const authenticatedUtilityPricingDeactivateApiSmoke = {
  ok: true,
  data: {
    id: "30000000-0000-0000-0000-000000000003",
    effectiveFrom: "2026-09-01",
    effectiveFromLabel: "01/09/2026",
    electricityUnitPrice: 4100,
    waterUnitPrice: 19000,
    isActive: false,
    statusLabel: "Lịch sử",
  },
  meta: {
    timing: {
      operation: "utility-pricing.deactivate",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        {
          name: "repository.insforge.utility-pricing-deactivate",
          durationMs: 1,
        },
      ],
    },
  },
} satisfies ApiResponse<UtilityPricingListItem>;

export function getAuthenticatedUtilityPricingApiSmokeResponses() {
  return {
    list: authenticatedUtilityPricingListApiSmoke,
    create: authenticatedUtilityPricingCreateApiSmoke,
    deactivate: authenticatedUtilityPricingDeactivateApiSmoke,
  };
}
