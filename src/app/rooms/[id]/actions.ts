"use server";

import { revalidatePath } from "next/cache";

import { updateActiveContractKeyTenant } from "@/lib/insforge/rental-repository";

export type KeyTenantActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const initialKeyTenantActionState: KeyTenantActionState = {
  status: "idle",
  message: null,
};

export async function markKeyTenant(
  _previousState: KeyTenantActionState,
  formData: FormData,
): Promise<KeyTenantActionState> {
  const roomId = String(formData.get("roomId") ?? "").trim();
  const tenantId = String(formData.get("tenantId") ?? "").trim();

  if (!roomId || !tenantId) {
    return {
      status: "error",
      message: "Chọn Tenant trong cùng phòng trước khi lưu Key Tenant.",
    };
  }

  const result = await updateActiveContractKeyTenant({ roomId, tenantId });

  if (result.error) {
    return {
      status: "error",
      message: result.error.message,
    };
  }

  revalidatePath("/rooms");
  revalidatePath(`/rooms/${roomId}`);

  return {
    status: "success",
    message: "Đã cập nhật Key Tenant cho active Contract.",
  };
}
