import type { ApiResponse } from "@/lib/api/response";
import type { RoomDetailView, RoomOperationsSummaryView } from "./presenter";

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
} satisfies ApiResponse<RoomOperationsSummaryView>;

export function getAuthenticatedRoomApiSmokeResponses() {
  return {
    detail: authenticatedRoomDetailApiSmoke,
    operationsSummary: authenticatedRoomOperationsSummaryApiSmoke,
  };
}
