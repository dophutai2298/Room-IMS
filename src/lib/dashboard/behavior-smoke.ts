import "server-only";

import {
  buildDashboardMissingUtilityMetrics,
  buildDashboardRevenue,
  buildDashboardRoomAvailability,
  buildDashboardUnpaidInvoices,
} from "./presenter";
import type {
  ContractRecord,
  InvoiceRecord,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
} from "@/lib/insforge/types";

export function runDashboardPresenterBehaviorSmoke() {
  const billingPeriod = { month: 8, year: 2026 };

  return {
    revenue: buildDashboardRevenue({
      invoices: smokeInvoices,
      billingPeriod,
    }),
    availability: buildDashboardRoomAvailability({
      rooms: smokeRooms,
      activeContracts: smokeContracts,
      tenants: smokeTenants,
    }),
    missingUtilityMetrics: buildDashboardMissingUtilityMetrics({
      rooms: smokeRooms,
      activeContracts: smokeContracts,
      tenants: smokeTenants,
      metrics: smokeMetrics,
      billingPeriod,
    }),
    unpaidInvoices: buildDashboardUnpaidInvoices({
      invoices: smokeInvoices,
      rooms: smokeRooms,
      billingPeriod,
    }),
  };
}

const smokeRooms: RoomRecord[] = [
  {
    id: "00000000-0000-0000-0000-000000000101",
    name: "P101",
    status: "Occupied",
    base_price: 2_500_000,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000102",
    name: "P102",
    status: "Available",
    base_price: 2_500_000,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const smokeTenants: TenantRecord[] = [
  {
    id: "00000000-0000-0000-0000-000000000201",
    room_id: smokeRooms[0].id,
    full_name: "Nguyen Van A",
    phone: null,
    is_key_tenant: true,
    status: "Active",
  },
];

const smokeContracts: ContractRecord[] = [
  {
    id: "00000000-0000-0000-0000-000000000301",
    room_id: smokeRooms[0].id,
    key_tenant_id: smokeTenants[0].id,
    deposit_amount: 2_500_000,
    start_date: "2026-01-01",
    end_date: null,
    status: "Active",
    rent_amount: 2_500_000,
    electricity_price_override: null,
    water_price_override: null,
  },
];

const smokeMetrics: UtilityMetricRecord[] = [
  {
    id: "00000000-0000-0000-0000-000000000401",
    room_id: smokeRooms[1].id,
    month: 8,
    year: 2026,
    electricity_old: 0,
    electricity_new: 10,
    water_old: 0,
    water_new: 2,
  },
];

const smokeInvoices: InvoiceRecord[] = [
  {
    id: "00000000-0000-0000-0000-000000000501",
    room_id: smokeRooms[0].id,
    month: 8,
    year: 2026,
    room_fee: 2_500_000,
    electricity_fee: 350_000,
    water_fee: 170_000,
    other_fee: 0,
    total_amount: 3_020_000,
    amount_paid: 1_000_000,
    status: "Partially Paid",
  },
  {
    id: "00000000-0000-0000-0000-000000000502",
    room_id: smokeRooms[0].id,
    month: 7,
    year: 2026,
    room_fee: 2_500_000,
    electricity_fee: 350_000,
    water_fee: 170_000,
    other_fee: 0,
    total_amount: 3_020_000,
    amount_paid: 3_020_000,
    status: "Paid",
  },
];
