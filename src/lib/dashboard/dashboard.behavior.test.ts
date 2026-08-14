import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardMissingUtilityMetricsFromCompactRows,
  buildDashboardMissingUtilityMetricsFromItems,
} from "./presenter";
import { buildRoomListItem } from "@/lib/rooms/presenter";
import type {
  ContractRecord,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
} from "@/lib/insforge/types";

const billingPeriod = { month: 8, year: 2026 };

test("compact Dashboard missing Utility Metrics rows preserve Room-list semantics", () => {
  const rooms: RoomRecord[] = [
    createRoom({ id: "room-1", name: "A101", status: "Occupied", base_price: 2_500_000 }),
    createRoom({ id: "room-2", name: "A102", status: "Occupied", base_price: 2_700_000 }),
    createRoom({ id: "room-3", name: "A103", status: "Maintenance", base_price: 2_900_000 }),
    createRoom({ id: "room-4", name: "A104", status: "Available", base_price: 3_100_000 }),
  ];
  const tenants: TenantRecord[] = [
    createTenant({ id: "tenant-1", room_id: "room-1", full_name: "Nguyen Van A" }),
    createTenant({ id: "tenant-2", room_id: "room-2", full_name: "Tran Thi B" }),
    createTenant({ id: "tenant-3", room_id: "room-3", full_name: "Le Van C" }),
  ];
  const activeContracts: ContractRecord[] = [
    createContract({
      id: "contract-1",
      room_id: "room-1",
      key_tenant_id: "tenant-1",
      rent_amount: 2_600_000,
    }),
    createContract({
      id: "contract-2",
      room_id: "room-2",
      key_tenant_id: "tenant-2",
      rent_amount: null,
    }),
    createContract({
      id: "contract-3",
      room_id: "room-3",
      key_tenant_id: "tenant-3",
      rent_amount: 3_000_000,
    }),
  ];
  const metrics: UtilityMetricRecord[] = [
    createMetric({ id: "metric-2", room_id: "room-2", month: 8, year: 2026 }),
    createMetric({ id: "metric-old", room_id: "room-1", month: 7, year: 2026 }),
  ];
  const roomItems = rooms.map((room) =>
    buildRoomListItem({
      room,
      tenants: tenants.filter((tenant) => tenant.room_id === room.id),
      activeContract:
        activeContracts.find((contract) => contract.room_id === room.id) ?? null,
    }),
  );

  const fromRoomItems = buildDashboardMissingUtilityMetricsFromItems({
    roomItems,
    metrics,
    billingPeriod,
  });
  const fromCompactRows = buildDashboardMissingUtilityMetricsFromCompactRows({
    rooms,
    activeContracts,
    tenants,
    metrics,
    billingPeriod,
  });

  assert.deepEqual(fromCompactRows, fromRoomItems);
  assert.deepEqual(fromCompactRows.rooms, [
    {
      id: "room-1",
      name: "A101",
      keyTenantName: "Nguyen Van A",
      basePrice: 2_600_000,
    },
  ]);
});

function createRoom(input: {
  id: string;
  name: string;
  status: RoomRecord["status"];
  base_price: number;
}): RoomRecord {
  return {
    ...input,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  };
}

function createTenant(input: {
  id: string;
  room_id: string;
  full_name: string;
}): TenantRecord {
  return {
    ...input,
    phone: "0900000000",
    is_key_tenant: true,
    status: "Active",
  };
}

function createContract(input: {
  id: string;
  room_id: string;
  key_tenant_id: string;
  rent_amount: number | null;
}): ContractRecord {
  return {
    ...input,
    deposit_amount: 5_000_000,
    start_date: "2026-01-01",
    end_date: null,
    status: "Active",
    electricity_price_override: null,
    water_price_override: null,
  };
}

function createMetric(input: {
  id: string;
  room_id: string;
  month: number;
  year: number;
}): UtilityMetricRecord {
  return {
    ...input,
    electricity_old: 100,
    electricity_new: 120,
    water_old: 10,
    water_new: 12,
  };
}
