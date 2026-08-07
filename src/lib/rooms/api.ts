import "server-only";

import { validationApiError, type ApiError } from "@/lib/api/errors";
import type { RoomWriteStatus } from "./repository";

type ValidationResult<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };

export async function validateRoomWriteRequest(
  request: Request,
): Promise<
  ValidationResult<{
    name: string;
    basePrice: number;
    status: RoomWriteStatus;
  }>
> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return {
      data: null,
      error: validationApiError({
        message: "Invalid Room request body.",
      }),
    };
  }

  const name = typeof body.name === "string" ? body.name : "";
  const basePrice = parseMoney(body.basePrice);
  const status = parseRoomWriteStatus(body.status);
  const fieldErrors: Record<string, string> = {};

  if (!name.trim()) {
    fieldErrors.name = "Room name is required.";
  }

  if (basePrice === null) {
    fieldErrors.basePrice = "Base rent must be a non-negative number.";
  }

  if (!status) {
    fieldErrors.status = "Room status must be Available or Maintenance.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      data: null,
      error: validationApiError({
        message: "Check Room information before saving.",
        details: { fieldErrors },
      }),
    };
  }

  return {
    data: {
      name,
      basePrice: basePrice as number,
      status: status as RoomWriteStatus,
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

function parseRoomWriteStatus(value: unknown): RoomWriteStatus | null {
  if (value === "Available" || value === "Maintenance") {
    return value;
  }

  return null;
}
