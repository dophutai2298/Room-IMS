import "server-only";

import { validationApiError, type ApiError } from "@/lib/api/errors";

type ValidationResult<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };

export async function validateCreateUtilityPricingRequest(
  request: Request,
): Promise<
  ValidationResult<{
    effectiveFrom: string;
    electricityUnitPrice: number;
    waterUnitPrice: number;
  }>
> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return {
      data: null,
      error: validationApiError({
        message: "Invalid Utility Pricing request body.",
      }),
    };
  }

  const effectiveFrom =
    typeof body.effectiveFrom === "string" ? body.effectiveFrom : "";
  const electricityUnitPrice = parseMoney(body.electricityUnitPrice);
  const waterUnitPrice = parseMoney(body.waterUnitPrice);
  const fieldErrors: Record<string, string> = {};

  if (!effectiveFrom.trim()) {
    fieldErrors.effectiveFrom = "Effective date is required.";
  }

  if (electricityUnitPrice === null) {
    fieldErrors.electricityUnitPrice =
      "Electricity unit price must be a non-negative number.";
  }

  if (waterUnitPrice === null) {
    fieldErrors.waterUnitPrice =
      "Water unit price must be a non-negative number.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      data: null,
      error: validationApiError({
        message: "Check Utility Pricing before saving.",
        details: { fieldErrors },
      }),
    };
  }

  return {
    data: {
      effectiveFrom,
      electricityUnitPrice: electricityUnitPrice as number,
      waterUnitPrice: waterUnitPrice as number,
    },
    error: null,
  };
}

function parseMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value !== "string" || !value) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
