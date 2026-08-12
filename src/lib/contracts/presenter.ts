import type { ContractDbStatus, ContractRecord, TenantRecord } from "@/lib/insforge/types";

export type ContractListItem = {
  id: string;
  roomId: string;
  keyTenantId: string;
  keyTenantName: string;
  depositAmount: number;
  rentAmount: number;
  electricityPriceOverride: number | null;
  waterPriceOverride: number | null;
  startDate: string;
  endDate: string | null;
  status: ContractDbStatus;
};

export const contractStatusLabel: Record<ContractDbStatus, string> = {
  Active: "Hiệu lực",
  Terminated: "Đã kết thúc",
};

export function buildContractList({
  contracts,
  tenants,
  roomBasePrice = 0,
}: {
  contracts: ContractRecord[];
  tenants: TenantRecord[];
  roomBasePrice?: number;
}): ContractListItem[] {
  const tenantNames = new Map(
    tenants.map((tenant) => [tenant.id, tenant.full_name] as const),
  );

  return contracts
    .map((contract) => ({
      id: contract.id,
      roomId: contract.room_id,
      keyTenantId: contract.key_tenant_id,
      keyTenantName: tenantNames.get(contract.key_tenant_id) ?? "Không xác định",
      depositAmount: toMoney(contract.deposit_amount),
      rentAmount: toMoney(contract.rent_amount ?? roomBasePrice),
      electricityPriceOverride: toNullableMoney(
        contract.electricity_price_override,
      ),
      waterPriceOverride: toNullableMoney(contract.water_price_override),
      startDate: contract.start_date,
      endDate: contract.end_date,
      status: contract.status,
    }))
    .sort(compareContracts);
}

export function compareContracts(
  left: ContractListItem,
  right: ContractListItem,
) {
  if (left.status !== right.status) {
    return left.status === "Active" ? -1 : 1;
  }

  return right.startDate.localeCompare(left.startDate);
}

function toMoney(value: number | string | null) {
  return Number(value ?? 0);
}

function toNullableMoney(value: number | string | null) {
  return value === null ? null : Number(value);
}
