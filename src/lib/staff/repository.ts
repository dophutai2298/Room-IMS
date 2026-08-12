import type { AppResult } from "@/lib/insforge/errors";
import type { StaffListItem } from "./presenter";

export type CreateStaffInput = {
  displayName: string;
  email: string;
  password: string;
};

export type StaffRepository = {
  listStaff(): Promise<AppResult<StaffListItem[]>>;
  createStaff(input: CreateStaffInput): Promise<AppResult<StaffListItem>>;
};
