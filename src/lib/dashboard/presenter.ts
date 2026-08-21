import { formatBillingPeriod, type BillingPeriod } from "@/lib/utilities/presenter";
import type {
  ContractRecord,
  InvoiceRecord,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
} from "@/lib/insforge/types";
import {
  deriveRoomStatus,
  type RoomListItem,
  type RoomUiStatus,
} from "@/lib/rooms/presenter";
import {
  getDashboardRevenueRangeDetails,
  normalizeDashboardRevenueRange,
  type DashboardRevenueRange,
} from "./revenue-range";

export type DashboardRevenuePoint = {
  period: string;
  billingPeriod: BillingPeriod;
  billed: number;
  collected: number;
};

export type DashboardRevenueView = {
  billingPeriod: BillingPeriod;
  periodLabel: string;
  billedRevenue: number;
  collectedRevenue: number;
  outstandingDebt: number;
  invoiceCount: number;
  chartRange: DashboardRevenueRange;
  chartInvoiceCount: number;
  chart: DashboardRevenuePoint[];
};

export type DashboardRoomAvailabilityView = {
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  maintenanceRooms: number;
  occupancyRate: number;
  rooms: DashboardRoomStatusItem[];
};

export type DashboardRoomStatusItem = {
  id: string;
  name: string;
  status: RoomUiStatus;
  keyTenantName: string | null;
  basePrice: number;
};

export type DashboardMissingUtilityMetricsView = {
  billingPeriod: BillingPeriod;
  periodLabel: string;
  rooms: DashboardReminderRoom[];
};

export type DashboardReminderRoom = {
  id: string;
  name: string;
  keyTenantName: string | null;
  basePrice: number;
};

export type DashboardUnpaidInvoicesView = {
  billingPeriod: BillingPeriod;
  periodLabel: string;
  totalBalanceDue: number;
  invoices: DashboardUnpaidInvoice[];
};

export type DashboardOperationsSummaryView = {
  revenue: DashboardRevenueView;
  missingUtilityMetrics: DashboardMissingUtilityMetricsView;
  unpaidInvoices: DashboardUnpaidInvoicesView;
};

export type DashboardUnpaidInvoice = {
  id: string;
  shortId: string;
  roomId: string;
  roomName: string;
  status: InvoiceRecord["status"];
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
};

export function buildDashboardRevenue({
  invoices,
  billingPeriod,
  chartRange,
}: {
  invoices: InvoiceRecord[];
  billingPeriod: BillingPeriod;
  chartRange?: unknown;
}): DashboardRevenueView {
  const currentInvoices = invoices.filter((invoice) =>
    isSamePeriod(invoice, billingPeriod),
  );
  const normalizedChartRange = normalizeDashboardRevenueRange(chartRange);
  const revenueTrend = buildRevenueTrend({
    invoices,
    billingPeriod,
    chartRange: normalizedChartRange,
  });

  return {
    billingPeriod,
    periodLabel: formatBillingPeriod(billingPeriod),
    billedRevenue: sumMoney(currentInvoices, "total_amount"),
    collectedRevenue: sumMoney(currentInvoices, "amount_paid"),
    outstandingDebt: currentInvoices.reduce(
      (total, invoice) =>
        total +
        Math.max(toMoney(invoice.total_amount) - toMoney(invoice.amount_paid), 0),
      0,
    ),
    invoiceCount: currentInvoices.length,
    chartRange: normalizedChartRange,
    chartInvoiceCount: revenueTrend.invoiceCount,
    chart: revenueTrend.points,
  };
}

export function buildDashboardRoomAvailability({
  roomItems,
}: {
  roomItems: RoomListItem[];
}): DashboardRoomAvailabilityView {
  const items = roomItems.map(toDashboardRoomStatusItem);
  const occupiedRooms = items.filter((room) => room.status === "occupied").length;
  const availableRooms = items.filter((room) => room.status === "available").length;
  const maintenanceRooms = items.filter((room) => room.status === "maintenance").length;

  return {
    totalRooms: items.length,
    occupiedRooms,
    availableRooms,
    maintenanceRooms,
    occupancyRate:
      items.length === 0 ? 0 : Math.round((occupiedRooms / items.length) * 100),
    rooms: items,
  };
}

export function buildDashboardMissingUtilityMetrics({
  roomItems,
  metrics,
  billingPeriod,
}: {
  roomItems: RoomListItem[];
  metrics: UtilityMetricRecord[];
  billingPeriod: BillingPeriod;
}): DashboardMissingUtilityMetricsView {
  const metricRoomIds = new Set(
    metrics
      .filter((metric) => isSamePeriod(metric, billingPeriod))
      .map((metric) => metric.room_id),
  );
  const missingRooms = roomItems
    .map(toDashboardRoomStatusItem)
    .filter((room) => room.status === "occupied" && !metricRoomIds.has(room.id))
    .map(({ id, name, keyTenantName, basePrice }) => ({
      id,
      name,
      keyTenantName,
      basePrice,
    }));

  return {
    billingPeriod,
    periodLabel: formatBillingPeriod(billingPeriod),
    rooms: missingRooms,
  };
}

export function buildDashboardRoomAvailabilityFromItems(
  roomItems: RoomListItem[],
) {
  return buildDashboardRoomAvailability({ roomItems });
}

export function buildDashboardMissingUtilityMetricsFromItems({
  roomItems,
  metrics,
  billingPeriod,
}: {
  roomItems: RoomListItem[];
  metrics: UtilityMetricRecord[];
  billingPeriod: BillingPeriod;
}) {
  return buildDashboardMissingUtilityMetrics({
    roomItems,
    metrics,
    billingPeriod,
  });
}

export type DashboardMissingUtilityMetricsRoomInput = Pick<
  RoomRecord,
  "id" | "name" | "status" | "base_price"
>;

export type DashboardMissingUtilityMetricsContractInput = Pick<
  ContractRecord,
  "id" | "room_id" | "key_tenant_id" | "rent_amount"
>;

export type DashboardMissingUtilityMetricsTenantInput = Pick<
  TenantRecord,
  "id" | "full_name"
>;

export function buildDashboardMissingUtilityMetricsFromCompactRows({
  rooms,
  activeContracts,
  tenants,
  metrics,
  billingPeriod,
}: {
  rooms: DashboardMissingUtilityMetricsRoomInput[];
  activeContracts: DashboardMissingUtilityMetricsContractInput[];
  tenants: DashboardMissingUtilityMetricsTenantInput[];
  metrics: UtilityMetricRecord[];
  billingPeriod: BillingPeriod;
}): DashboardMissingUtilityMetricsView {
  const metricRoomIds = new Set(
    metrics
      .filter((metric) => isSamePeriod(metric, billingPeriod))
      .map((metric) => metric.room_id),
  );
  const tenantNameById = new Map(
    tenants.map((tenant) => [tenant.id, tenant.full_name]),
  );
  const activeContractByRoomId = new Map<
    string,
    DashboardMissingUtilityMetricsContractInput
  >();

  for (const contract of activeContracts) {
    if (!activeContractByRoomId.has(contract.room_id)) {
      activeContractByRoomId.set(contract.room_id, contract);
    }
  }

  const missingRooms = rooms
    .map((room) => {
      const activeContract = activeContractByRoomId.get(room.id) ?? null;

      return {
        room,
        activeContract,
        status: deriveRoomStatus(room.status, activeContract),
      };
    })
    .filter(
      ({ room, status }) =>
        status === "occupied" && !metricRoomIds.has(room.id),
    )
    .map(({ room, activeContract }) => ({
      id: room.id,
      name: room.name,
      keyTenantName: activeContract
        ? tenantNameById.get(activeContract.key_tenant_id) ?? null
        : null,
      basePrice: toMoney(activeContract?.rent_amount ?? room.base_price),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    billingPeriod,
    periodLabel: formatBillingPeriod(billingPeriod),
    rooms: missingRooms,
  };
}

export function buildDashboardOperationsSummaryFromCompactRows({
  rooms,
  activeContracts,
  tenants,
  metrics,
  invoices,
  billingPeriod,
}: {
  rooms: DashboardMissingUtilityMetricsRoomInput[];
  activeContracts: DashboardMissingUtilityMetricsContractInput[];
  tenants: DashboardMissingUtilityMetricsTenantInput[];
  metrics: UtilityMetricRecord[];
  invoices: InvoiceRecord[];
  billingPeriod: BillingPeriod;
}): DashboardOperationsSummaryView {
  return {
    revenue: buildDashboardRevenue({
      invoices,
      billingPeriod,
      chartRange: "6m",
    }),
    missingUtilityMetrics: buildDashboardMissingUtilityMetricsFromCompactRows({
      rooms,
      activeContracts,
      tenants,
      metrics,
      billingPeriod,
    }),
    unpaidInvoices: buildDashboardUnpaidInvoices({
      rooms,
      invoices,
      billingPeriod,
    }),
  };
}

export function buildDashboardUnpaidInvoices({
  invoices,
  rooms,
  billingPeriod,
}: {
  invoices: InvoiceRecord[];
  rooms: Array<Pick<RoomRecord, "id" | "name">>;
  billingPeriod: BillingPeriod;
}): DashboardUnpaidInvoicesView {
  const roomNameById = new Map(rooms.map((room) => [room.id, room.name]));
  const unpaidInvoices = invoices
    .filter((invoice) => isSamePeriod(invoice, billingPeriod))
    .filter((invoice) => invoice.status !== "Paid")
    .map((invoice) => {
      const totalAmount = toMoney(invoice.total_amount);
      const amountPaid = toMoney(invoice.amount_paid);

      return {
        id: invoice.id,
        shortId: `INV-${String(invoice.year).slice(-2)}${String(invoice.month).padStart(2, "0")}-${invoice.id.slice(0, 8).toUpperCase()}`,
        roomId: invoice.room_id,
        roomName: roomNameById.get(invoice.room_id) ?? "Unknown room",
        status: invoice.status,
        totalAmount,
        amountPaid,
        balanceDue: Math.max(totalAmount - amountPaid, 0),
      };
    })
    .sort((left, right) => right.balanceDue - left.balanceDue);

  return {
    billingPeriod,
    periodLabel: formatBillingPeriod(billingPeriod),
    totalBalanceDue: unpaidInvoices.reduce(
      (total, invoice) => total + invoice.balanceDue,
      0,
    ),
    invoices: unpaidInvoices,
  };
}

function toDashboardRoomStatusItem(room: RoomListItem): DashboardRoomStatusItem {
  return {
    id: room.id,
    name: room.name,
    status: room.status,
    keyTenantName: room.keyTenantName,
    basePrice: room.basePrice,
  };
}

function buildRevenueTrend({
  invoices,
  billingPeriod,
  chartRange,
}: {
  invoices: InvoiceRecord[];
  billingPeriod: BillingPeriod;
  chartRange: DashboardRevenueRange;
}) {
  const invoicesByPeriod = new Map<number, InvoiceRecord[]>();

  for (const invoice of invoices) {
    const period = toInvoiceBillingPeriod(invoice);

    if (!period || compareBillingPeriods(period, billingPeriod) > 0) {
      continue;
    }

    const periodIndex = toBillingPeriodIndex(period);
    const periodInvoices = invoicesByPeriod.get(periodIndex) ?? [];
    periodInvoices.push(invoice);
    invoicesByPeriod.set(periodIndex, periodInvoices);
  }

  const rangeDetails = getDashboardRevenueRangeDetails(chartRange);
  const periods =
    rangeDetails.monthCount === null
      ? getAllInvoiceBillingPeriods({ invoicesByPeriod, billingPeriod })
      : getRecentBillingPeriods({
          billingPeriod,
          count: rangeDetails.monthCount,
        });
  let invoiceCount = 0;
  const points = periods.map((period) => {
    const periodInvoices =
      invoicesByPeriod.get(toBillingPeriodIndex(period)) ?? [];
    invoiceCount += periodInvoices.length;

    return {
      period: formatBillingPeriod(period),
      billingPeriod: period,
      billed: sumMoney(periodInvoices, "total_amount"),
      collected: sumMoney(periodInvoices, "amount_paid"),
    };
  });

  return { invoiceCount, points };
}

function getRecentBillingPeriods({
  billingPeriod,
  count,
}: {
  billingPeriod: BillingPeriod;
  count: number;
}) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      Date.UTC(billingPeriod.year, billingPeriod.month - 1 - (count - index - 1), 1),
    );

    return {
      month: date.getUTCMonth() + 1,
      year: date.getUTCFullYear(),
    };
  });
}

function getAllInvoiceBillingPeriods({
  invoicesByPeriod,
  billingPeriod,
}: {
  invoicesByPeriod: Map<number, InvoiceRecord[]>;
  billingPeriod: BillingPeriod;
}) {
  let earliestPeriodIndex: number | null = null;

  for (const periodIndex of invoicesByPeriod.keys()) {
    if (earliestPeriodIndex === null || periodIndex < earliestPeriodIndex) {
      earliestPeriodIndex = periodIndex;
    }
  }

  if (earliestPeriodIndex === null) {
    return [];
  }

  return getBillingPeriodsBetween({
    startPeriodIndex: earliestPeriodIndex,
    endPeriodIndex: toBillingPeriodIndex(billingPeriod),
  });
}

function getBillingPeriodsBetween({
  startPeriodIndex,
  endPeriodIndex,
}: {
  startPeriodIndex: number;
  endPeriodIndex: number;
}) {
  return Array.from(
    { length: endPeriodIndex - startPeriodIndex + 1 },
    (_, offset) => fromBillingPeriodIndex(startPeriodIndex + offset),
  );
}

function toInvoiceBillingPeriod(invoice: InvoiceRecord): BillingPeriod | null {
  const month = Number(invoice.month);
  const year = Number(invoice.year);

  return Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(year) &&
    year >= 2000 &&
    year <= 2100
    ? { month, year }
    : null;
}

function toBillingPeriodIndex({ month, year }: BillingPeriod) {
  return year * 12 + month - 1;
}

function fromBillingPeriodIndex(periodIndex: number): BillingPeriod {
  return {
    month: (periodIndex % 12) + 1,
    year: Math.floor(periodIndex / 12),
  };
}

function compareBillingPeriods(left: BillingPeriod, right: BillingPeriod) {
  return toBillingPeriodIndex(left) - toBillingPeriodIndex(right);
}

function isSamePeriod(
  record: { month: number | string; year: number | string },
  billingPeriod: BillingPeriod,
) {
  return (
    Number(record.month) === billingPeriod.month &&
    Number(record.year) === billingPeriod.year
  );
}

function sumMoney<T extends "total_amount" | "amount_paid">(
  invoices: InvoiceRecord[],
  field: T,
) {
  return invoices.reduce((total, invoice) => total + toMoney(invoice[field]), 0);
}

function toMoney(value: number | string | null) {
  return Number(value ?? 0);
}
