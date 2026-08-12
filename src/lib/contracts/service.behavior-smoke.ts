import "server-only";

import type { AppResult } from "@/lib/insforge/errors";
import type { ContractListItem } from "./presenter";
import type {
  ContractRepository,
  CreateContractInput,
  UpdateContractInput,
} from "./repository";
import {
  createContractForOperations,
  listRoomContractsForOperations,
  updateContractForOperations,
} from "./service";

export async function runContractServiceBehaviorSmoke() {
  const repository = createSmokeRepository();

  return {
    listContracts: await listRoomContractsForOperations({
      repository,
      roomId,
    }),
    createActiveContract: await createContractForOperations({
      repository,
      roomId,
      ...contractValues,
    }),
    updateContractAndPreserveOverrides: await updateContractForOperations({
      repository,
      contractId: activeContract.id,
      status: "Active",
      ...contractValues,
      electricityPriceOverride: 4_100,
      waterPriceOverride: 19_000,
    }),
    rejectInvalidDateRange: await updateContractForOperations({
      repository,
      contractId: activeContract.id,
      status: "Active",
      ...contractValues,
      startDate: "2026-09-01",
      endDate: "2026-08-01",
    }),
    rejectNegativeRent: await createContractForOperations({
      repository,
      roomId,
      ...contractValues,
      rentAmount: -1,
    }),
  };
}

function createSmokeRepository(): ContractRepository {
  return {
    async listRoomContracts() {
      return ok([activeContract]);
    },
    async createContract(input) {
      return ok(contractFromCreate(input));
    },
    async updateContract(input) {
      return ok(contractFromUpdate(input));
    },
  };
}

const roomId = "00000000-0000-0000-0000-000000000101";
const keyTenantId = "00000000-0000-0000-0000-000000000201";
const contractValues = {
  keyTenantId,
  depositAmount: 2_500_000,
  rentAmount: 2_500_000,
  electricityPriceOverride: null,
  waterPriceOverride: null,
  startDate: "2026-08-01",
  endDate: null,
};

const activeContract: ContractListItem = {
  id: "00000000-0000-0000-0000-000000000301",
  roomId,
  keyTenantId,
  keyTenantName: "Tenant Demo",
  depositAmount: 2_500_000,
  rentAmount: 2_500_000,
  electricityPriceOverride: null,
  waterPriceOverride: null,
  startDate: "2026-08-01",
  endDate: null,
  status: "Active",
};

function contractFromCreate(input: CreateContractInput): ContractListItem {
  return {
    ...activeContract,
    ...input,
    id: activeContract.id,
    keyTenantName: activeContract.keyTenantName,
    status: "Active",
  };
}

function contractFromUpdate(input: UpdateContractInput): ContractListItem {
  return {
    ...activeContract,
    ...input,
    id: input.contractId,
  };
}

function ok<T>(data: T): AppResult<T> {
  return { data, error: null };
}
