import type { AppResult } from "@/lib/insforge/errors";
import type { ContractDbStatus } from "@/lib/insforge/types";
import type { ContractListItem } from "./presenter";

export type ContractWriteValues = {
  keyTenantId: string;
  depositAmount: number;
  rentAmount: number;
  electricityPriceOverride: number | null;
  waterPriceOverride: number | null;
  startDate: string;
  endDate: string | null;
};

export type CreateContractInput = ContractWriteValues & {
  roomId: string;
};

export type UpdateContractInput = ContractWriteValues & {
  contractId: string;
  status: ContractDbStatus;
};

export type ContractRepository = {
  listRoomContracts(roomId: string): Promise<AppResult<ContractListItem[]>>;
  createContract(
    input: CreateContractInput,
  ): Promise<AppResult<ContractListItem>>;
  updateContract(
    input: UpdateContractInput,
  ): Promise<AppResult<ContractListItem>>;
};
