import { formatBillingPeriod } from "@/lib/utilities/presenter";
import type {
  ContractRecord,
  InvoiceRecord,
  RoomDbStatus,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
} from "@/lib/insforge/types";

export type RoomUiStatus = "occupied" | "available" | "maintenance";

export type RoomListItem = {
  id: string;
  name: string;
  status: RoomUiStatus;
  basePrice: number;
  roomBasePrice: number;
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

export type RoomOperationsSummaryView = {
  utilityMetrics: {
    metricCount: number;
    latestPeriodLabel: string | null;
    latestElectricityReading: number | null;
    latestWaterReading: number | null;
    latestElectricityConsumption: number | null;
    latestWaterConsumption: number | null;
  };
  invoices: {
    invoiceCount: number;
    unpaidCount: number;
    totalBalanceDue: number;
    latestInvoice: RoomInvoiceSummary | null;
  };
};

export type RoomInvoiceSummary = {
  id: string;
  periodLabel: string;
  status: InvoiceRecord["status"];
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
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
    roomBasePrice: toMoney(room.base_price),
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

export function buildRoomOperationsSummary({
  metrics,
  invoices,
}: {
  metrics: UtilityMetricRecord[];
  invoices: InvoiceRecord[];
}): RoomOperationsSummaryView {
  const sortedMetrics = [...metrics].sort(comparePeriodDescending);
  const latestMetric = sortedMetrics[0] ?? null;
  const sortedInvoices = [...invoices].sort(comparePeriodDescending);
  const latestInvoice = sortedInvoices[0] ?? null;

  return {
    utilityMetrics: {
      metricCount: metrics.length,
      latestPeriodLabel: latestMetric ? periodLabelOf(latestMetric) : null,
      latestElectricityReading: latestMetric
        ? toMoney(latestMetric.electricity_new)
        : null,
      latestWaterReading: latestMetric ? toMoney(latestMetric.water_new) : null,
      latestElectricityConsumption: latestMetric
        ? toMoney(latestMetric.electricity_new) -
          toMoney(latestMetric.electricity_old)
        : null,
      latestWaterConsumption: latestMetric
        ? toMoney(latestMetric.water_new) - toMoney(latestMetric.water_old)
        : null,
    },
    invoices: {
      invoiceCount: invoices.length,
      unpaidCount: invoices.filter((invoice) => invoice.status !== "Paid").length,
      totalBalanceDue: invoices.reduce(
        (total, invoice) =>
          total +
          Math.max(toMoney(invoice.total_amount) - toMoney(invoice.amount_paid), 0),
        0,
      ),
      latestInvoice: latestInvoice
        ? {
            id: latestInvoice.id,
            periodLabel: periodLabelOf(latestInvoice),
            status: latestInvoice.status,
            totalAmount: toMoney(latestInvoice.total_amount),
            amountPaid: toMoney(latestInvoice.amount_paid),
            balanceDue: Math.max(
              toMoney(latestInvoice.total_amount) -
                toMoney(latestInvoice.amount_paid),
              0,
            ),
          }
        : null,
    },
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

function periodLabelOf(value: { month: number | string; year: number | string }) {
  return formatBillingPeriod({
    month: Number(value.month),
    year: Number(value.year),
  });
}

function comparePeriodDescending(
  left: { month: number | string; year: number | string },
  right: { month: number | string; year: number | string },
) {
  const leftYear = Number(left.year);
  const rightYear = Number(right.year);

  if (leftYear !== rightYear) {
    return rightYear - leftYear;
  }

  return Number(right.month) - Number(left.month);
}
