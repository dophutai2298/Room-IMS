import type { ApiResponse } from "@/lib/api/response";
import type { ContractListItem } from "./presenter";

const contract: ContractListItem = {
  id: "00000000-0000-0000-0000-000000000301",
  roomId: "00000000-0000-0000-0000-000000000101",
  keyTenantId: "00000000-0000-0000-0000-000000000201",
  keyTenantName: "Tenant Demo",
  depositAmount: 2_500_000,
  rentAmount: 2_500_000,
  electricityPriceOverride: 3_900,
  waterPriceOverride: 18_000,
  startDate: "2026-08-01",
  endDate: null,
  status: "Active",
};

const authenticatedContractListApiSmoke = {
  ok: true,
  data: [contract],
  meta: {
    timing: {
      operation: "contracts.list",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "repository.insforge.contracts-list", durationMs: 1 },
        { name: "service", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<ContractListItem[]>;

const authenticatedContractCreateApiSmoke = {
  ok: true,
  data: contract,
  meta: {
    timing: {
      operation: "contracts.create",
      totalMs: 1,
      spans: [
        { name: "validation", durationMs: 1 },
        { name: "auth", durationMs: 1 },
        { name: "repository.insforge.contract-create", durationMs: 1 },
        { name: "service", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<ContractListItem>;

const authenticatedContractUpdateApiSmoke = {
  ok: true,
  data: { ...contract, rentAmount: 2_700_000 },
  meta: {
    timing: {
      operation: "contracts.update",
      totalMs: 1,
      spans: [
        { name: "validation", durationMs: 1 },
        { name: "auth", durationMs: 1 },
        { name: "repository.insforge.contract-update", durationMs: 1 },
        { name: "service", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<ContractListItem>;

export function getAuthenticatedContractApiSmokeResponses() {
  return {
    list: authenticatedContractListApiSmoke,
    create: authenticatedContractCreateApiSmoke,
    update: authenticatedContractUpdateApiSmoke,
  };
}
