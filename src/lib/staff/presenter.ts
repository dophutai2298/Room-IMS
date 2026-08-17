export type StaffListItem = {
  id: string;
  authUserId: string;
  email: string;
  displayName: string;
  status: StaffAccountStatus;
  createdAt: string;
  updatedAt: string;
};

export type StaffAccountStatus = "active" | "disabled";

export const staffAccountStatusLabel = {
  active: "Đang hoạt động",
  disabled: "Đã vô hiệu hóa",
} satisfies Record<StaffAccountStatus, string>;
