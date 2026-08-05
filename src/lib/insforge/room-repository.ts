import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import {
  buildRoomDetailView,
  buildRoomOperationsSummary,
} from "@/lib/rooms/presenter";
import type { RoomDetailRepository } from "@/lib/rooms/repository";
import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import type {
  ContractRecord,
  InvoiceRecord,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
} from "./types";

export function createInsForgeRoomRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): RoomDetailRepository {
  return {
    async readRoomDetail(roomId) {
      const query = () => readRoomDetailFromInsForge(roomId);

      return timer
        ? timer.measure("repository.insforge.room-detail", query)
        : query();
    },
    async readRoomOperationsSummary(roomId) {
      const query = () => readRoomOperationsSummaryFromInsForge(roomId);

      return timer
        ? timer.measure("repository.insforge.room-operations-summary", query)
        : query();
    },
  };
}

async function readRoomDetailFromInsForge(
  roomId: string,
): Promise<AppResult<ReturnType<typeof buildRoomDetailView>>> {
  try {
    const client = await createInsForgeServerClient();
    const [rooms, tenants, activeContracts] = await Promise.all([
      client.database
        .from("rooms")
        .select("id, name, status, base_price")
        .eq("id", roomId)
        .limit(1),
      client.database
        .from("tenants")
        .select("id, room_id, full_name, phone, is_key_tenant, status")
        .eq("room_id", roomId)
        .order("full_name"),
      client.database
        .from("contracts")
        .select(
          [
            "id",
            "room_id",
            "key_tenant_id",
            "deposit_amount",
            "start_date",
            "end_date",
            "status",
            "rent_amount",
            "electricity_price_override",
            "water_price_override",
          ].join(", "),
        )
        .eq("room_id", roomId)
        .eq("status", "Active")
        .order("start_date"),
    ]);

    for (const response of [rooms, tenants, activeContracts]) {
      if (response.error) {
        return fail(response.error);
      }
    }

    const room = ((rooms.data ?? []) as unknown as RoomRecord[])[0];

    if (!room) {
      return appError({
        message: "Room was not found.",
        code: "ROOM_NOT_FOUND",
        statusCode: 404,
      });
    }

    return ok(
      buildRoomDetailView({
        room,
        tenants: (tenants.data ?? []) as unknown as TenantRecord[],
        activeContract:
          ((activeContracts.data ?? []) as unknown as ContractRecord[])[0] ??
          null,
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readRoomOperationsSummaryFromInsForge(
  roomId: string,
): Promise<AppResult<ReturnType<typeof buildRoomOperationsSummary>>> {
  try {
    const client = await createInsForgeServerClient();
    const [rooms, metrics, invoices] = await Promise.all([
      client.database.from("rooms").select("id").eq("id", roomId).limit(1),
      client.database
        .from("utility_metrics")
        .select(
          [
            "id",
            "room_id",
            "month",
            "year",
            "electricity_old",
            "electricity_new",
            "water_old",
            "water_new",
          ].join(", "),
        )
        .eq("room_id", roomId)
        .order("year")
        .order("month"),
      client.database
        .from("invoices")
        .select(
          [
            "id",
            "room_id",
            "month",
            "year",
            "room_fee",
            "electricity_fee",
            "water_fee",
            "other_fee",
            "total_amount",
            "amount_paid",
            "status",
          ].join(", "),
        )
        .eq("room_id", roomId)
        .order("year")
        .order("month"),
    ]);

    for (const response of [rooms, metrics, invoices]) {
      if (response.error) {
        return fail(response.error);
      }
    }

    const room = ((rooms.data ?? []) as unknown as Pick<RoomRecord, "id">[])[0];

    if (!room) {
      return appError({
        message: "Room was not found.",
        code: "ROOM_NOT_FOUND",
        statusCode: 404,
      });
    }

    return ok(
      buildRoomOperationsSummary({
        metrics: (metrics.data ?? []) as unknown as UtilityMetricRecord[],
        invoices: (invoices.data ?? []) as unknown as InvoiceRecord[],
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}
