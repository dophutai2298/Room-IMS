import type { AppResult } from "@/lib/insforge/errors";
import type { StaffListItem } from "./presenter";

export type CreateStaffInput = {
  displayName: string;
  email: string;
  password: string;
};

export type UpdateStaffInput = {
  staffId: string;
  displayName: string;
};

export type DeleteStaffInput = {
  staffId: string;
};

export type StaffRepository = {
  listStaff(): Promise<AppResult<StaffListItem[]>>;
  createStaff(input: CreateStaffInput): Promise<AppResult<StaffListItem>>;
  updateStaff(input: UpdateStaffInput): Promise<AppResult<StaffListItem>>;
  deleteStaff(input: DeleteStaffInput): Promise<AppResult<StaffListItem>>;
};
