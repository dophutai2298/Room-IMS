import "server-only";

import { appError, type AppResult } from "@/lib/insforge/errors";
import type { TenantCccdImage, TenantListItem } from "./presenter";
import type {
  DeleteTenantResult,
  ListTenantsInput,
  TenantRepository,
  TenantWriteStatus,
  UpdateTenantInput,
  UploadTenantCccdImagesInput,
  WriteTenantInput,
} from "./repository";

export async function listTenantsForOperations({
  repository,
  search,
}: ListTenantsInput & {
  repository: TenantRepository;
}): Promise<AppResult<TenantListItem[]>> {
  return repository.listTenants({ search: normalizeOptionalText(search) });
}

export async function listRoomTenantsForOperations({
  repository,
  roomId,
}: {
  repository: TenantRepository;
  roomId: string;
}): Promise<AppResult<TenantListItem[]>> {
  if (!roomId.trim()) {
    return appError({
      message: "Room id is required.",
      code: "ROOM_ID_REQUIRED",
      statusCode: 422,
    });
  }

  return repository.listRoomTenants(roomId);
}

export async function createTenantForOperations({
  repository,
  ...input
}: WriteTenantInput & {
  repository: TenantRepository;
}): Promise<AppResult<TenantListItem>> {
  const validation = validateTenantWrite(input);

  if (validation.error) {
    return validation;
  }

  return repository.createTenant(validation.data);
}

export async function getTenantForOperations({
  repository,
  tenantId,
}: {
  repository: TenantRepository;
  tenantId: string;
}): Promise<AppResult<TenantListItem>> {
  if (!tenantId.trim()) {
    return appError({
      message: "Tenant id is required.",
      code: "TENANT_ID_REQUIRED",
      statusCode: 422,
    });
  }

  return repository.readTenant(tenantId);
}

export async function updateTenantForOperations({
  repository,
  ...input
}: UpdateTenantInput & {
  repository: TenantRepository;
}): Promise<AppResult<TenantListItem>> {
  if (!input.tenantId.trim()) {
    return appError({
      message: "Tenant id is required.",
      code: "TENANT_ID_REQUIRED",
      statusCode: 422,
    });
  }

  const validation = validateTenantWrite(input);

  if (validation.error) {
    return validation;
  }

  return repository.updateTenant({
    ...validation.data,
    tenantId: input.tenantId,
  });
}

export async function deleteTenantForOperations({
  repository,
  tenantId,
}: {
  repository: TenantRepository;
  tenantId: string;
}): Promise<AppResult<DeleteTenantResult>> {
  if (!tenantId.trim()) {
    return appError({
      message: "Tenant id is required.",
      code: "TENANT_ID_REQUIRED",
      statusCode: 422,
    });
  }

  return repository.deleteTenant(tenantId);
}

export async function uploadTenantCccdImagesForOperations({
  repository,
  tenantId,
  images,
}: UploadTenantCccdImagesInput & {
  repository: TenantRepository;
}): Promise<AppResult<TenantCccdImage[]>> {
  if (!tenantId.trim()) {
    return appError({
      message: "Tenant id is required.",
      code: "TENANT_ID_REQUIRED",
      statusCode: 422,
    });
  }

  if (images.length === 0) {
    return appError({
      message: "Select at least one CCCD image before uploading.",
      code: "TENANT_CCCD_IMAGES_REQUIRED",
      statusCode: 422,
    });
  }

  if (images.length > 6) {
    return appError({
      message: "Upload up to 6 CCCD images at a time.",
      code: "TENANT_CCCD_IMAGES_TOO_MANY",
      statusCode: 422,
    });
  }

  for (const image of images) {
    const validation = validateCccdImage(image);

    if (validation.error) {
      return validation;
    }
  }

  return repository.uploadTenantCccdImages({ tenantId, images });
}

function validateTenantWrite(input: WriteTenantInput): AppResult<WriteTenantInput> {
  const roomId = input.roomId.trim();
  const name = input.name.trim();
  const phone = input.phone.trim();
  const cccdNumber = input.cccdNumber.trim();

  if (!roomId) {
    return appError({
      message: "Room id is required.",
      code: "ROOM_ID_REQUIRED",
      statusCode: 422,
    });
  }

  if (!name) {
    return appError({
      message: "Tenant name is required.",
      code: "TENANT_NAME_REQUIRED",
      statusCode: 422,
    });
  }

  if (!phone) {
    return appError({
      message: "Tenant phone is required.",
      code: "TENANT_PHONE_REQUIRED",
      statusCode: 422,
    });
  }

  if (!cccdNumber) {
    return appError({
      message: "Tenant CCCD number is required.",
      code: "TENANT_CCCD_NUMBER_REQUIRED",
      statusCode: 422,
    });
  }

  if (!isTenantWriteStatus(input.status)) {
    return appError({
      message: "Tenant status must be Active or Moved Out.",
      code: "TENANT_STATUS_INVALID",
      statusCode: 422,
    });
  }

  return {
    data: {
      roomId,
      name,
      phone,
      dateOfBirth: normalizeOptionalText(input.dateOfBirth),
      permanentAddress: normalizeOptionalText(input.permanentAddress),
      cccdNumber,
      status: input.status,
    },
    error: null,
  };
}

function validateCccdImage(image: File): AppResult<File> {
  if (!image.size) {
    return appError({
      message: "CCCD image is empty.",
      code: "TENANT_CCCD_IMAGE_EMPTY",
      statusCode: 422,
    });
  }

  if (image.size > 5 * 1024 * 1024) {
    return appError({
      message: "Each CCCD image must be 5MB or smaller.",
      code: "TENANT_CCCD_IMAGE_TOO_LARGE",
      statusCode: 422,
    });
  }

  if (!allowedImageTypes.has(image.type)) {
    return appError({
      message: "CCCD image must be JPG, PNG, WEBP, HEIC, or HEIF.",
      code: "TENANT_CCCD_IMAGE_TYPE_INVALID",
      statusCode: 422,
    });
  }

  return { data: image, error: null };
}

function isTenantWriteStatus(value: string): value is TenantWriteStatus {
  return value === "Active" || value === "Moved Out";
}

function normalizeOptionalText(value: string | null | undefined) {
  const cleaned = value?.trim();

  return cleaned ? cleaned : null;
}

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
