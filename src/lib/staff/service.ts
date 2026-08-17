import "server-only";

import { appError, type AppResult } from "@/lib/insforge/errors";
import type { StaffListItem } from "./presenter";
import type {
  CreateStaffInput,
  DeleteStaffInput,
  StaffRepository,
  UpdateStaffInput,
} from "./repository";
import {
  validateAndNormalizeStaffInput,
  validateAndNormalizeStaffUpdateInput,
} from "./validation";

export async function listStaffForOperations({
  repository,
}: {
  repository: StaffRepository;
}): Promise<AppResult<StaffListItem[]>> {
  return repository.listStaff();
}

export async function createStaffForOperations({
  repository,
  displayName,
  email,
  password,
}: CreateStaffInput & {
  repository: StaffRepository;
}): Promise<AppResult<StaffListItem>> {
  const validation = validateAndNormalizeStaffInput({
    displayName,
    email,
    password,
  });

  if (validation.fieldErrors) {
    return appError({
      message: "Check Staff account information before saving.",
      code: "STAFF_INPUT_INVALID",
      statusCode: 422,
    });
  }

  return repository.createStaff(validation.data);
}

export async function updateStaffForOperations({
  repository,
  staffId,
  displayName,
}: UpdateStaffInput & {
  repository: StaffRepository;
}): Promise<AppResult<StaffListItem>> {
  const validation = validateAndNormalizeStaffUpdateInput({
    displayName,
  });

  if (validation.fieldErrors) {
    return appError({
      message: "Check Staff account information before saving.",
      code: "STAFF_INPUT_INVALID",
      statusCode: 422,
    });
  }

  return repository.updateStaff({
    staffId,
    displayName: validation.data.displayName,
  });
}

export async function deleteStaffForOperations({
  repository,
  staffId,
}: DeleteStaffInput & {
  repository: StaffRepository;
}): Promise<AppResult<StaffListItem>> {
  return repository.deleteStaff({ staffId });
}
