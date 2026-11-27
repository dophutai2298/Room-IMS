import type { RoomDbStatus } from "@/lib/insforge/types";
import type { RoomDetailView, RoomListItem, RoomUiStatus } from "@/lib/rooms/presenter";

export type SupabaseRoomRow = {
  id: string;
  name: string;
  floor: number | null;
  status: RoomDbStatus;
  base_price: number | string;
  owner_app_user_id: string;
  created_at: string;
  updated_at: string;
};

export function toSupabaseRoomListItem(room: SupabaseRoomRow): RoomListItem {
  const status = storedRoomStatus(room.status);
  const basePrice = Number(room.base_price);
  return {
    id: room.id,
    name: room.name,
    floor: room.floor,
    status,
    basePrice,
    roomBasePrice: basePrice,
    tenantCount: 0,
    keyTenantName: null,
    activeContractId: null,
    nextAction: status === "maintenance"
      ? "Kiểm tra bảo trì"
      : status === "occupied"
        ? "Cập nhật Tenant/Contract"
        : "Sẵn sàng cho thuê",
  };
}

export function toSupabaseRoomDetail(room: SupabaseRoomRow): RoomDetailView {
  return {
    room: {
      id: room.id,
      name: room.name,
      floor: room.floor,
      status: storedRoomStatus(room.status),
      storedStatus: room.status,
      basePrice: Number(room.base_price),
    },
    tenants: [],
    activeContract: null,
    keyTenantName: null,
    integrityWarning: null,
  };
}

function storedRoomStatus(status: RoomDbStatus): RoomUiStatus {
  if (status === "Maintenance") return "maintenance";
  if (status === "Occupied") return "occupied";
  return "available";
}
