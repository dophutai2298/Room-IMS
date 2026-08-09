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
    phone: string;
    dateOfBirth: string | null;
    permanentAddress: string | null;
    cccdNumber: string;
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

  const parsedRoomId = roomId ?? readString(body.roomId);
  const name = readString(body.name);
  const phone = readString(body.phone);
  const dateOfBirth = readOptionalString(body.dateOfBirth);
  const permanentAddress = readOptionalString(body.permanentAddress);
  const cccdNumber = readString(body.cccdNumber);
  const status = parseTenantStatus(body.status);
  const fieldErrors: Record<string, string> = {};

  if (!parsedRoomId.trim()) {
    fieldErrors.roomId = "Room is required.";
  }

  if (!name.trim()) {
    fieldErrors.name = "Tenant name is required.";
  }

  if (!phone.trim()) {
    fieldErrors.phone = "Tenant phone is required.";
  }

  if (!cccdNumber.trim()) {
    fieldErrors.cccdNumber = "Tenant CCCD number is required.";
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
      roomId: parsedRoomId,
      name,
      phone,
      dateOfBirth,
      permanentAddress,
      cccdNumber,
      status: status as TenantWriteStatus,
    },
    error: null,
  };
}

export async function validateTenantCccdUploadRequest(
  request: Request,
): Promise<ValidationResult<{ images: File[] }>> {
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return {
      data: null,
      error: validationApiError({
        message: "Invalid CCCD upload request.",
      }),
    };
  }

  const images = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File);

  if (images.length === 0) {
    return {
      data: null,
      error: validationApiError({
        message: "Select at least one CCCD image before uploading.",
        details: {
          fieldErrors: {
            images: "Select at least one CCCD image before uploading.",
          },
        },
      }),
    };
  }

  return {
    data: { images },
    error: null,
  };
}

function parseTenantStatus(value: unknown): TenantWriteStatus | null {
  if (value === "Active" || value === "Moved Out") {
    return value;
  }

  return null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readOptionalString(value: unknown) {
  const cleaned = readString(value).trim();

  return cleaned ? cleaned : null;
}
