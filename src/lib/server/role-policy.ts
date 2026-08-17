import type { AppRole } from "@/lib/insforge/types";

export type OperationalAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "administer";

export const operationalReadRoles = ["landlord", "staff"] as const;
export const operationalCreateRoles = ["landlord", "staff"] as const;
export const landlordOnlyRoles = ["landlord"] as const;

export const existingDataMutationForbiddenMessage =
  "Chỉ Admin mới được quyền cập nhật hoặc xóa dữ liệu.";

export const adminOnlyForbiddenMessage =
  "Chỉ Admin mới được quyền quản lý dữ liệu này.";

export function getAllowedRolesForOperationalAction(
  action: OperationalAction,
): readonly AppRole[] {
  if (action === "read") {
    return operationalReadRoles;
  }

  if (action === "create") {
    return operationalCreateRoles;
  }

  return landlordOnlyRoles;
}

export function canRolePerformOperationalAction(
  role: AppRole,
  action: OperationalAction,
) {
  return getAllowedRolesForOperationalAction(action).includes(role);
}
