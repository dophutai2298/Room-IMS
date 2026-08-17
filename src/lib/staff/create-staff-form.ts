import type { CreateStaffInput } from "./repository";

export type CreateStaffDraft = CreateStaffInput & {
  confirmPassword: string;
};

export type CreateStaffSubmission =
  | {
      fieldErrors: Record<string, never>;
      payload: CreateStaffInput;
    }
  | {
      fieldErrors: Record<string, string>;
      payload: null;
    };

export function prepareCreateStaffSubmission(
  draft: CreateStaffDraft,
): CreateStaffSubmission {
  const fieldErrors: Record<string, string> = {};

  if (draft.password !== draft.confirmPassword) {
    fieldErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      payload: null,
    };
  }

  return {
    fieldErrors: {},
    payload: {
      displayName: draft.displayName,
      email: draft.email,
      password: draft.password,
    },
  };
}
