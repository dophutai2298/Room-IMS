import "server-only";

import { appError, type AppResult } from "@/lib/insforge/errors";
import type { ContractDbStatus } from "@/lib/insforge/types";
import type { ContractListItem } from "./presenter";
import type {
  ContractRepository,
  ContractWriteValues,
  CreateContractInput,
  UpdateContractInput,
} from "./repository";

export async function listRoomContractsForOperations({
  repository,
  roomId,
}: {
  repository: ContractRepository;
  roomId: string;
}): Promise<AppResult<ContractListItem[]>> {
  if (!roomId.trim()) {
    return requiredIdError("Room", "ROOM_ID_REQUIRED");
  }

  return repository.listRoomContracts(roomId);
}

export async function createContractForOperations({
  repository,
  ...input
}: CreateContractInput & {
  repository: ContractRepository;
}): Promise<AppResult<ContractListItem>> {
  if (!input.roomId.trim()) {
    return requiredIdError("Room", "ROOM_ID_REQUIRED");
  }

  const validation = validateContractWrite(input);

  if (validation.error) {
    return validation;
  }

  return repository.createContract({
    roomId: input.roomId,
    ...validation.data,
  });
}

export async function updateContractForOperations({
  repository,
  ...input
}: UpdateContractInput & {
  repository: ContractRepository;
}): Promise<AppResult<ContractListItem>> {
  if (!input.contractId.trim()) {
    return requiredIdError("Contract", "CONTRACT_ID_REQUIRED");
  }

  if (!isContractStatus(input.status)) {
    return appError({
      message: "Contract status must be Active or Terminated.",
      code: "CONTRACT_STATUS_INVALID",
      statusCode: 422,
    });
  }

  const validation = validateContractWrite(input);

  if (validation.error) {
    return validation;
  }

  return repository.updateContract({
    contractId: input.contractId,
    status: input.status,
    ...validation.data,
  });
}

function validateContractWrite(
  input: ContractWriteValues,
): AppResult<ContractWriteValues> {
  const keyTenantId = input.keyTenantId.trim();
  const startDate = input.startDate.trim();
  const endDate = normalizeOptionalText(input.endDate);

  if (!keyTenantId) {
    return requiredIdError("Key Tenant", "KEY_TENANT_ID_REQUIRED");
  }

  if (!isIsoDate(startDate)) {
    return appError({
      message: "Contract start date must use YYYY-MM-DD.",
      code: "CONTRACT_START_DATE_INVALID",
      statusCode: 422,
    });
  }

  if (endDate && !isIsoDate(endDate)) {
    return appError({
      message: "Contract end date must use YYYY-MM-DD.",
      code: "CONTRACT_END_DATE_INVALID",
      statusCode: 422,
    });
  }

  if (endDate && endDate < startDate) {
    return appError({
      message: "Contract end date cannot be before its start date.",
      code: "CONTRACT_DATE_RANGE_INVALID",
      statusCode: 422,
    });
  }

  for (const [field, value] of [
    ["rent amount", input.rentAmount],
    ["deposit amount", input.depositAmount],
  ] as const) {
    if (!isNonNegativeMoney(value)) {
      return invalidMoneyError(field);
    }
  }

  for (const [field, value] of [
    ["electricity price override", input.electricityPriceOverride],
    ["water price override", input.waterPriceOverride],
  ] as const) {
    if (value !== null && !isNonNegativeMoney(value)) {
      return invalidMoneyError(field);
    }
  }

  return {
    data: {
      keyTenantId,
      startDate,
      endDate,
      rentAmount: roundMoney(input.rentAmount),
      depositAmount: roundMoney(input.depositAmount),
      electricityPriceOverride: roundNullableMoney(
        input.electricityPriceOverride,
      ),
      waterPriceOverride: roundNullableMoney(input.waterPriceOverride),
    },
    error: null,
  };
}

function requiredIdError(label: string, code: string) {
  return appError({
    message: `${label} id is required.`,
    code,
    statusCode: 422,
  });
}

function invalidMoneyError(field: string) {
  return appError({
    message: `Contract ${field} must be a non-negative number.`,
    code: "CONTRACT_MONEY_INVALID",
    statusCode: 422,
  });
}

function isContractStatus(value: string): value is ContractDbStatus {
  return value === "Active" || value === "Terminated";
}

function isNonNegativeMoney(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeOptionalText(value: string | null | undefined) {
  const cleaned = value?.trim();

  return cleaned ? cleaned : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundNullableMoney(value: number | null) {
  return value === null ? null : roundMoney(value);
}
