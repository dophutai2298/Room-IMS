import { formatBillingPeriod, type BillingPeriod } from "@/lib/utilities/presenter";
import type {
  InvoiceRecord,
  RoomRecord,
  UtilityMetricRecord,
} from "@/lib/insforge/types";
import type { RoomListItem, RoomUiStatus } from "@/lib/rooms/presenter";

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
}: {
  invoices: InvoiceRecord[];
  billingPeriod: BillingPeriod;
}): DashboardRevenueView {
  const currentInvoices = invoices.filter((invoice) =>
    isSamePeriod(invoice, billingPeriod),
  );

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
    chart: buildRevenueTrend({ invoices, billingPeriod }),
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

export function buildDashboardUnpaidInvoices({
  invoices,
  rooms,
  billingPeriod,
}: {
  invoices: InvoiceRecord[];
  rooms: RoomRecord[];
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
}: {
  invoices: InvoiceRecord[];
  billingPeriod: BillingPeriod;
}) {
  return getRecentBillingPeriods({ billingPeriod, count: 6 }).map((period) => {
    const periodInvoices = invoices.filter((invoice) =>
      isSamePeriod(invoice, period),
    );

    return {
      period: formatBillingPeriod(period),
      billingPeriod: period,
      billed: sumMoney(periodInvoices, "total_amount"),
      collected: sumMoney(periodInvoices, "amount_paid"),
    };
  });
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
