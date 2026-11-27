import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { appError, fail, ok, type AppResult, toAppBackendError } from "@/lib/insforge/errors";
import type { RoomOperationsSummaryView } from "@/lib/rooms/presenter";
import type { RoomRepository } from "@/lib/rooms/repository";
import { getActiveOwnerAppUserId } from "@/lib/server/operational-owner-scope";
import { toSupabaseRoomDetail, toSupabaseRoomListItem, type SupabaseRoomRow } from "./room-mapping";
import { createSupabaseServerClient } from "./server";

const roomColumns = "id, name, floor, status, base_price, owner_app_user_id, created_at, updated_at";

export function createSupabaseRoomRepository({
  timer,
}: { timer?: ApiTimer } = {}): RoomRepository {
  type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
  let clientPromise: Promise<Client> | null = null;
  const client = () => (clientPromise ??= createSupabaseServerClient());
  const measure = <T>(name: string, work: () => Promise<AppResult<T>>) =>
    timer ? timer.measure(name, work) : work();

  return {
    listRoomItems() {
      return measure("repository.supabase.rooms-list", async () => {
        try {
          const db = await client();
          const result = await db.from("rooms").select(roomColumns)
            .eq("owner_app_user_id", getActiveOwnerAppUserId()).order("name");
          if (result.error) return fail(result.error, "Could not read Rooms");
          return ok(((result.data ?? []) as SupabaseRoomRow[]).map(toSupabaseRoomListItem));
        } catch (error) { return { data: null, error: toAppBackendError(error) }; }
      });
    },
    createRoom(input) {
      return measure("repository.supabase.room-create", async () => {
        try {
          const db = await client();
          const result = await db.from("rooms").insert({
            name: input.name,
            floor: input.floor ?? null,
            status: input.status,
            base_price: input.basePrice,
            owner_app_user_id: getActiveOwnerAppUserId(),
          }).select(roomColumns).single();
          if (result.error) return fail(result.error, "Could not create Room");
          return ok(toSupabaseRoomListItem(result.data as SupabaseRoomRow));
        } catch (error) { return { data: null, error: toAppBackendError(error) }; }
      });
    },
    updateRoom(input) {
      return measure("repository.supabase.room-update", async () => {
        try {
          const db = await client();
          const result = await db.from("rooms").update({
            name: input.name,
            floor: input.floor ?? null,
            status: input.status,
            base_price: input.basePrice,
            updated_at: new Date().toISOString(),
          }).eq("id", input.roomId)
            .eq("owner_app_user_id", getActiveOwnerAppUserId())
            .select(roomColumns).maybeSingle();
          if (result.error) return fail(result.error, "Could not update Room");
          return result.data
            ? ok(toSupabaseRoomListItem(result.data as SupabaseRoomRow))
            : roomNotFound();
        } catch (error) { return { data: null, error: toAppBackendError(error) }; }
      });
    },
    readRoomDetail(roomId) {
      return measure("repository.supabase.room-detail", async () => {
        try {
          const db = await client();
          const result = await db.from("rooms").select(roomColumns)
            .eq("id", roomId)
            .eq("owner_app_user_id", getActiveOwnerAppUserId()).maybeSingle();
          if (result.error) return fail(result.error, "Could not read Room");
          return result.data
            ? ok(toSupabaseRoomDetail(result.data as SupabaseRoomRow))
            : roomNotFound();
        } catch (error) { return { data: null, error: toAppBackendError(error) }; }
      });
    },
    readRoomOperationsSummary(roomId) {
      return measure("repository.supabase.room-operations-summary", async () => {
        try {
          const db = await client();
          const result = await db.from("rooms").select("id")
            .eq("id", roomId)
            .eq("owner_app_user_id", getActiveOwnerAppUserId()).maybeSingle();
          if (result.error) return fail(result.error, "Could not read Room");
          return result.data ? ok(emptyOperationsSummary()) : roomNotFound();
        } catch (error) { return { data: null, error: toAppBackendError(error) }; }
      });
    },
  };
}

function roomNotFound() {
  return appError({ message: "Room was not found.", code: "ROOM_NOT_FOUND", statusCode: 404 });
}

function emptyOperationsSummary(): RoomOperationsSummaryView {
  // Ticket 03/04 will introduce related entities and replace this interim view.
  return {
    utilityMetrics: {
      metricCount: 0, latestPeriodLabel: null, latestElectricityReading: null,
      latestWaterReading: null, latestElectricityConsumption: null,
      latestWaterConsumption: null,
    },
    invoices: {
      invoiceCount: 0, unpaidCount: 0, totalBalanceDue: 0, latestInvoice: null,
    },
  };
}
