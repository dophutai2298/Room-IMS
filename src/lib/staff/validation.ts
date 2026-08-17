import type { CreateStaffInput, UpdateStaffInput } from "./repository";

export type StaffInputValidation =
  | { data: CreateStaffInput; fieldErrors: null }
  | { data: null; fieldErrors: Record<string, string> };

export type StaffUpdateValidation =
  | { data: Omit<UpdateStaffInput, "staffId">; fieldErrors: null }
  | { data: null; fieldErrors: Record<string, string> };

export function validateAndNormalizeStaffInput(input: {
  displayName: unknown;
  email: unknown;
  password: unknown;
}): StaffInputValidation {
  const data = {
    displayName:
      typeof input.displayName === "string" ? input.displayName.trim() : "",
    email:
      typeof input.email === "string" ? input.email.trim().toLowerCase() : "",
    password: typeof input.password === "string" ? input.password : "",
  };
  const fieldErrors: Record<string, string> = {};

  if (data.displayName.length < 2) {
    fieldErrors.displayName = "Display name must contain at least 2 characters.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (data.password.length < 8) {
    fieldErrors.password = "Password must contain at least 8 characters.";
  }

  return Object.keys(fieldErrors).length > 0
    ? { data: null, fieldErrors }
    : { data, fieldErrors: null };
}

export function validateAndNormalizeStaffUpdateInput(input: {
  displayName: unknown;
}): StaffUpdateValidation {
  const data = {
    displayName:
      typeof input.displayName === "string" ? input.displayName.trim() : "",
  };
  const fieldErrors: Record<string, string> = {};

  if (data.displayName.length < 2) {
    fieldErrors.displayName = "Display name must contain at least 2 characters.";
  }

  return Object.keys(fieldErrors).length > 0
    ? { data: null, fieldErrors }
    : { data, fieldErrors: null };
}
