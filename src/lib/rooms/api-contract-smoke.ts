import type { ApiResponse } from "@/lib/api/response";
import type {
  RoomDetailView,
  RoomListItem,
  RoomOperationsSummaryView,
} from "./presenter";

const authenticatedRoomListApiSmoke = {
  ok: true,
  data: [
    {
      id: "00000000-0000-0000-0000-000000000101",
      name: "P101",
      status: "occupied",
      basePrice: 2500000,
      roomBasePrice: 2500000,
      tenantCount: 1,
      keyTenantName: "Tenant Demo",
      activeContractId: "00000000-0000-0000-0000-000000000301",
      nextAction: "Cập nhật Tenant/Contract",
    },
  ],
  meta: {
    timing: {
      operation: "rooms.list",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.rooms-list", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<RoomListItem[]>;

const authenticatedRoomCreateApiSmoke = {
  ok: true,
  data: {
    id: "00000000-0000-0000-0000-000000000104",
    name: "P104",
    status: "available",
    basePrice: 2800000,
    roomBasePrice: 2800000,
    tenantCount: 0,
    keyTenantName: null,
    activeContractId: null,
    nextAction: "Sẵn sàng cho thuê",
  },
  meta: {
    timing: {
      operation: "rooms.create",
      totalMs: 1,
      spans: [
        { name: "validation", durationMs: 1 },
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.room-create", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<RoomListItem>;

const authenticatedRoomUpdateApiSmoke = {
  ok: true,
  data: {
    id: "00000000-0000-0000-0000-000000000104",
    name: "P104",
    status: "maintenance",
    basePrice: 2800000,
    roomBasePrice: 2800000,
    tenantCount: 0,
    keyTenantName: null,
    activeContractId: null,
    nextAction: "Kiểm tra bảo trì",
  },
  meta: {
    timing: {
      operation: "rooms.update",
      totalMs: 1,
      spans: [
        { name: "validation", durationMs: 1 },
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.room-update", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<RoomListItem>;

const authenticatedRoomDetailApiSmoke = {
  ok: true,
  data: {
    room: {
      id: "00000000-0000-0000-0000-000000000101",
      name: "P101",
      status: "occupied",
      storedStatus: "Occupied",
      basePrice: 2500000,
    },
    tenants: [
      {
        id: "00000000-0000-0000-0000-000000000201",
        name: "Tenant Demo",
        phone: "0900000000",
        status: "Active",
        isKeyTenant: true,
      },
    ],
    activeContract: {
      id: "00000000-0000-0000-0000-000000000301",
      keyTenantId: "00000000-0000-0000-0000-000000000201",
      rentAmount: 2500000,
      depositAmount: 2500000,
      startDate: "2026-07-01",
      endDate: null,
      status: "Active",
    },
    keyTenantName: "Tenant Demo",
    integrityWarning: null,
  },
  meta: {
    timing: {
      operation: "rooms.detail",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.room-detail", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<RoomDetailView>;

const authenticatedRoomOperationsSummaryApiSmoke = {
  ok: true,
  data: {
    utilityMetrics: {
      metricCount: 1,
      latestPeriodLabel: "07/2026",
      latestElectricityReading: 120,
      latestWaterReading: 30,
      latestElectricityConsumption: 20,
      latestWaterConsumption: 5,
    },
    invoices: {
      invoiceCount: 1,
      unpaidCount: 1,
      totalBalanceDue: 3020000,
      latestInvoice: {
        id: "00000000-0000-0000-0000-000000000501",
        periodLabel: "07/2026",
        status: "Unpaid",
        totalAmount: 3020000,
        amountPaid: 0,
        balanceDue: 3020000,
      },
    },
  },
  meta: {
    timing: {
      operation: "rooms.operations-summary",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.room-operations-summary", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<RoomOperationsSummaryView>;

export function getAuthenticatedRoomApiSmokeResponses() {
  return {
    list: authenticatedRoomListApiSmoke,
    create: authenticatedRoomCreateApiSmoke,
    update: authenticatedRoomUpdateApiSmoke,
    detail: authenticatedRoomDetailApiSmoke,
    operationsSummary: authenticatedRoomOperationsSummaryApiSmoke,
  };
}
