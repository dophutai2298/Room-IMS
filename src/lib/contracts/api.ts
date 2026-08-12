import "server-only";

import { validationApiError, type ApiError } from "@/lib/api/errors";
import type { ContractDbStatus } from "@/lib/insforge/types";
import type { ContractWriteValues } from "./repository";

type ValidationResult<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };

export async function validateContractCreateRequest(
  request: Request,
): Promise<ValidationResult<ContractWriteValues>> {
  return validateContractWriteRequest(request, false);
}

export async function validateContractUpdateRequest(
  request: Request,
): Promise<ValidationResult<ContractWriteValues & { status: ContractDbStatus }>> {
  return validateContractWriteRequest(request, true);
}

async function validateContractWriteRequest(
  request: Request,
  includeStatus: false,
): Promise<ValidationResult<ContractWriteValues>>;
async function validateContractWriteRequest(
  request: Request,
  includeStatus: true,
): Promise<ValidationResult<ContractWriteValues & { status: ContractDbStatus }>>;
async function validateContractWriteRequest(
  request: Request,
  includeStatus: boolean,
): Promise<
  ValidationResult<ContractWriteValues & { status?: ContractDbStatus }>
> {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return invalidBody();
  }

  const keyTenantId = readString(body.keyTenantId);
  const startDate = readString(body.startDate);
  const endDate = readOptionalString(body.endDate);
  const rentAmount = readNumber(body.rentAmount);
  const depositAmount = readNumber(body.depositAmount);
  const electricityPriceOverride = readOptionalNumber(
    body.electricityPriceOverride,
  );
  const waterPriceOverride = readOptionalNumber(body.waterPriceOverride);
  const status = includeStatus ? readContractStatus(body.status) : undefined;
  const fieldErrors: Record<string, string> = {};

  if (!keyTenantId.trim()) {
    fieldErrors.keyTenantId = "Key Tenant is required.";
  }

  if (!startDate.trim()) {
    fieldErrors.startDate = "Start date is required.";
  }

  if (!Number.isFinite(rentAmount)) {
    fieldErrors.rentAmount = "Rent amount must be a number.";
  }

  if (!Number.isFinite(depositAmount)) {
    fieldErrors.depositAmount = "Deposit amount must be a number.";
  }

  if (electricityPriceOverride === undefined) {
    fieldErrors.electricityPriceOverride =
      "Electricity price override must be empty or a number.";
  }

  if (waterPriceOverride === undefined) {
    fieldErrors.waterPriceOverride =
      "Water price override must be empty or a number.";
  }

  if (includeStatus && !status) {
    fieldErrors.status = "Contract status must be Active or Terminated.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      data: null,
      error: validationApiError({
        message: "Check Contract information before saving.",
        details: { fieldErrors },
      }),
    };
  }

  return {
    data: {
      keyTenantId,
      startDate,
      endDate,
      rentAmount,
      depositAmount,
      electricityPriceOverride: electricityPriceOverride as number | null,
      waterPriceOverride: waterPriceOverride as number | null,
      ...(status ? { status } : {}),
    },
    error: null,
  };
}

function invalidBody(): ValidationResult<never> {
  return {
    data: null,
    error: validationApiError({ message: "Invalid Contract request body." }),
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readOptionalString(value: unknown) {
  const cleaned = readString(value).trim();

  return cleaned ? cleaned : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" ? value : Number.NaN;
}

function readOptionalNumber(value: unknown) {
  if (value === null || value === "" || value === undefined) {
    return null;
  }

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readContractStatus(value: unknown): ContractDbStatus | null {
  return value === "Active" || value === "Terminated" ? value : null;
}
