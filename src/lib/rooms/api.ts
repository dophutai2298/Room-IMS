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
    floor: number | null;
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
  const floor = parseFloor(body.floor);
  const basePrice = parseMoney(body.basePrice);
  const status = parseRoomWriteStatus(body.status);
  const fieldErrors: Record<string, string> = {};

  if (!name.trim()) {
    fieldErrors.name = "Room name is required.";
  }

  if (basePrice === null) {
    fieldErrors.basePrice = "Base rent must be a non-negative number.";
  }

  if (floor === undefined) {
    fieldErrors.floor = "Floor must be a whole number between 0 and 200.";
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
      floor: floor as number | null,
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

function parseFloor(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 200) {
    return undefined;
  }

  return parsed;
}

function parseRoomWriteStatus(value: unknown): RoomWriteStatus | null {
  if (value === "Available" || value === "Maintenance") {
    return value;
  }

  return null;
}
