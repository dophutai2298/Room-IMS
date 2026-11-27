import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { appError, fail, ok, type AppResult, toAppBackendError } from "@/lib/insforge/errors";
import { buildRoomDetailView, buildRoomListItem, buildRoomOperationsSummary } from "@/lib/rooms/presenter";
import type { ContractRecord, TenantRecord, UtilityMetricRecord, InvoiceRecord } from "@/lib/insforge/types";
import type { RoomRepository } from "@/lib/rooms/repository";
import { getActiveOwnerAppUserId } from "@/lib/server/operational-owner-scope";
import { toSupabaseRoomListItem, type SupabaseRoomRow } from "./room-mapping";
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
          const owner = getActiveOwnerAppUserId();
          const [rooms, tenants, contracts] = await Promise.all([
            db.from("rooms").select(roomColumns).eq("owner_app_user_id", owner).order("name"),
            db.from("tenants").select("id,room_id,full_name,status").eq("owner_app_user_id", owner),
            db.from("contracts").select("id,room_id,key_tenant_id,rent_amount,status").eq("owner_app_user_id", owner).eq("status", "Active"),
          ]);
          if (rooms.error || tenants.error || contracts.error) return fail(rooms.error || tenants.error || contracts.error, "Could not read Rooms");
          return ok(((rooms.data ?? []) as SupabaseRoomRow[]).map((room) => buildRoomListItem({
            room: { ...room, base_price: Number(room.base_price) }, tenants: (tenants.data ?? []).filter((tenant) => tenant.room_id === room.id) as TenantRecord[],
            activeContract: ((contracts.data ?? []).find((contract) => contract.room_id === room.id) ?? null) as ContractRecord | null,
          })));
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
          const owner = getActiveOwnerAppUserId();
          const [room, tenants, contracts] = await Promise.all([
            db.from("rooms").select(roomColumns).eq("id", roomId).eq("owner_app_user_id", owner).maybeSingle(),
            db.from("tenants").select("id,room_id,full_name,phone,status,is_key_tenant").eq("room_id", roomId).eq("owner_app_user_id", owner),
            db.from("contracts").select("id,room_id,key_tenant_id,deposit_amount,rent_amount,start_date,end_date,status")
              .eq("room_id", roomId).eq("owner_app_user_id", owner).eq("status", "Active").limit(1),
          ]);
          if (room.error || tenants.error || contracts.error) return fail(room.error || tenants.error || contracts.error, "Could not read Room");
          return room.data ? ok(buildRoomDetailView({
            room: { ...room.data, base_price: Number(room.data.base_price) }, tenants: (tenants.data ?? []) as TenantRecord[],
            activeContract: (contracts.data?.[0] ?? null) as ContractRecord | null,
          })) : roomNotFound();
        } catch (error) { return { data: null, error: toAppBackendError(error) }; }
      });
    },
    readRoomOperationsSummary(roomId) {
      return measure("repository.supabase.room-operations-summary", async () => {
        try {
          const db = await client();
          const owner = getActiveOwnerAppUserId();
          const [room, metrics, invoices] = await Promise.all([
            db.from("rooms").select("id").eq("id", roomId).eq("owner_app_user_id", owner).maybeSingle(),
            db.from("utility_metrics").select("id,room_id,month,year,electricity_old,electricity_new,water_old,water_new")
              .eq("room_id", roomId).eq("owner_app_user_id", owner),
            db.from("invoices").select("id,room_id,month,year,total_amount,amount_paid,status")
              .eq("room_id", roomId).eq("owner_app_user_id", owner),
          ]);
          if (room.error || metrics.error || invoices.error) return fail(room.error || metrics.error || invoices.error, "Could not read Room operations");
          return room.data ? ok(buildRoomOperationsSummary({
            metrics: (metrics.data ?? []) as UtilityMetricRecord[],
            invoices: (invoices.data ?? []) as InvoiceRecord[],
          })) : roomNotFound();
        } catch (error) { return { data: null, error: toAppBackendError(error) }; }
      });
    },
  };
}

function roomNotFound() {
  return appError({ message: "Room was not found.", code: "ROOM_NOT_FOUND", statusCode: 404 });
}
