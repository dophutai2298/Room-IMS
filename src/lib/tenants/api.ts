import "server-only";

import { validationApiError, type ApiError } from "@/lib/api/errors";
import type { TenantWriteStatus } from "./repository";

type ValidationResult<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };

export async function validateTenantWriteRequest({
  request,
  roomId,
}: {
  request: Request;
  roomId?: string;
}): Promise<
  ValidationResult<{
    roomId: string;
    name: string;
    phone: string | null;
    status: TenantWriteStatus;
  }>
> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return {
      data: null,
      error: validationApiError({
        message: "Invalid Tenant request body.",
      }),
    };
  }

  const name = typeof body.name === "string" ? body.name : "";
  const phone = typeof body.phone === "string" ? body.phone : null;
  const status = parseTenantStatus(body.status);
  const fieldErrors: Record<string, string> = {};

  if (roomId !== undefined && !roomId.trim()) {
    fieldErrors.roomId = "Room id is required.";
  }

  if (!name.trim()) {
    fieldErrors.name = "Tenant name is required.";
  }

  if (!status) {
    fieldErrors.status = "Tenant status must be Active or Moved Out.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      data: null,
      error: validationApiError({
        message: "Check Tenant information before saving.",
        details: { fieldErrors },
      }),
    };
  }

  return {
    data: {
      roomId: roomId ?? "",
      name,
      phone,
      status: status as TenantWriteStatus,
    },
    error: null,
  };
}

function parseTenantStatus(value: unknown): TenantWriteStatus | null {
  if (value === "Active" || value === "Moved Out") {
    return value;
  }

  return null;
}
