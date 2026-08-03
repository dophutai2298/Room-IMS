import type { ContractRecord, RoomDbStatus, RoomRecord, TenantRecord } from "@/lib/insforge/types";

export type RoomUiStatus = "occupied" | "available" | "maintenance";

export type RoomListItem = {
  id: string;
  name: string;
  status: RoomUiStatus;
  basePrice: number;
  tenantCount: number;
  keyTenantName: string | null;
  activeContractId: string | null;
  nextAction: string;
};

export type RoomDetailView = {
  room: {
    id: string;
    name: string;
    status: RoomUiStatus;
    storedStatus: RoomDbStatus;
    basePrice: number;
  };
  tenants: TenantView[];
  activeContract: ContractView | null;
  keyTenantName: string | null;
  integrityWarning: string | null;
};

export type TenantView = {
  id: string;
  name: string;
  phone: string | null;
  status: TenantRecord["status"];
  isKeyTenant: boolean;
};

export type ContractView = {
  id: string;
  keyTenantId: string;
  rentAmount: number;
  depositAmount: number;
  startDate: string;
  endDate: string | null;
  status: ContractRecord["status"];
};

export const roomStatusLabel: Record<RoomUiStatus, string> = {
  occupied: "Đang thuê",
  available: "Trống",
  maintenance: "Bảo trì",
};

export function buildRoomListItem({
  room,
  tenants,
  activeContract,
}: {
  room: RoomRecord;
  tenants: TenantRecord[];
  activeContract: ContractRecord | null;
}): RoomListItem {
  const status = deriveRoomStatus(room.status, activeContract);
  const activeTenants = tenants.filter((tenant) => tenant.status === "Active");
  const keyTenant = activeContract
    ? tenants.find((tenant) => tenant.id === activeContract.key_tenant_id)
    : null;

  return {
    id: room.id,
    name: room.name,
    status,
    basePrice: toMoney(activeContract?.rent_amount ?? room.base_price),
    tenantCount: activeTenants.length,
    keyTenantName: keyTenant?.full_name ?? null,
    activeContractId: activeContract?.id ?? null,
    nextAction: getNextAction(status, activeContract),
  };
}

export function buildRoomDetailView({
  room,
  tenants,
  activeContract,
}: {
  room: RoomRecord;
  tenants: TenantRecord[];
  activeContract: ContractRecord | null;
}): RoomDetailView {
  const keyTenant = activeContract
    ? tenants.find((tenant) => tenant.id === activeContract.key_tenant_id)
    : null;
  const integrityWarning =
    activeContract && !keyTenant
      ? "Active Contract đang trỏ tới Key Tenant không thuộc phòng này."
      : null;

  return {
    room: {
      id: room.id,
      name: room.name,
      status: deriveRoomStatus(room.status, activeContract),
      storedStatus: room.status,
      basePrice: toMoney(room.base_price),
    },
    tenants: tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.full_name,
      phone: tenant.phone,
      status: tenant.status,
      isKeyTenant: activeContract?.key_tenant_id === tenant.id,
    })),
    activeContract: activeContract
      ? {
          id: activeContract.id,
          keyTenantId: activeContract.key_tenant_id,
          rentAmount: toMoney(activeContract.rent_amount ?? room.base_price),
          depositAmount: toMoney(activeContract.deposit_amount),
          startDate: activeContract.start_date,
          endDate: activeContract.end_date,
          status: activeContract.status,
        }
      : null,
    keyTenantName: keyTenant?.full_name ?? null,
    integrityWarning,
  };
}

export function deriveRoomStatus(
  storedStatus: RoomDbStatus,
  activeContract: ContractRecord | null,
): RoomUiStatus {
  if (storedStatus === "Maintenance") {
    return "maintenance";
  }

  return activeContract ? "occupied" : "available";
}

function getNextAction(status: RoomUiStatus, activeContract: ContractRecord | null) {
  if (status === "maintenance") {
    return "Kiểm tra bảo trì";
  }

  if (!activeContract) {
    return "Sẵn sàng cho thuê";
  }

  return "Cập nhật Tenant/Contract";
}

function toMoney(value: number | string | null): number {
  return Number(value ?? 0);
}
