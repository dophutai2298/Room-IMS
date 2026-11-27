import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { appError, fail, ok, type AppResult, toAppBackendError } from "@/lib/insforge/errors";
import type { ContractRecord, RoomRecord, TenantCccdImageRecord, TenantRecord } from "@/lib/insforge/types";
import { getActiveOwnerAppUserId } from "@/lib/server/operational-owner-scope";
import { buildTenantList, type TenantListItem } from "@/lib/tenants/presenter";
import type { TenantRepository } from "@/lib/tenants/repository";
import { createSupabaseServerClient } from "./server";

export const tenantDocumentBucket = "tenant-cccd-private";
const tenantColumns = "id,room_id,full_name,phone,date_of_birth,permanent_address,cccd_number,is_key_tenant,cccd_front_url,cccd_back_url,status,owner_app_user_id";
const imageColumns = "id,tenant_id,storage_key,file_name,mime_type,file_size,created_at,owner_app_user_id";

export function createSupabaseTenantRepository({ timer }: { timer?: ApiTimer } = {}): TenantRepository {
  type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;
  let promise: Promise<Db> | undefined;
  const client = () => (promise ??= createSupabaseServerClient());
  const measure = <T>(name: string, fn: () => Promise<AppResult<T>>) => timer ? timer.measure(name, fn) : fn();
  const guarded = async <T>(fn: () => Promise<AppResult<T>>): Promise<AppResult<T>> => {
    try { return await fn(); } catch (error) { return { data: null, error: toAppBackendError(error) }; }
  };
  const owner = () => getActiveOwnerAppUserId();

  async function present(db: Db, tenants: TenantRecord[]): Promise<AppResult<TenantListItem[]>> {
    if (!tenants.length) return ok([]);
    const roomIds = [...new Set(tenants.map((t) => t.room_id).filter((id): id is string => Boolean(id)))];
    const [rooms, contracts, images] = await Promise.all([
      roomIds.length ? db.from("rooms").select("id,name").eq("owner_app_user_id", owner()).in("id", roomIds) : Promise.resolve({ data: [] as Array<Pick<RoomRecord,"id"|"name">>, error: null }),
      db.from("contracts").select("key_tenant_id").eq("owner_app_user_id", owner()).eq("status", "Active"),
      db.from("tenant_cccd_images").select(imageColumns).eq("owner_app_user_id", owner()).in("tenant_id", tenants.map((t) => t.id)),
    ]);
    if (rooms.error || contracts.error || images.error) return fail(rooms.error || contracts.error || images.error, "Could not read Tenant relationships");
    const mappedImages = (images.data ?? []).map((image) => ({
      ...image,
      public_url: `/api/tenants/${image.tenant_id}/cccd-images/${image.id}/content`,
    })) as TenantCccdImageRecord[];
    return ok(buildTenantList({
      tenants, rooms: rooms.data ?? [],
      activeContracts: (contracts.data ?? []) as ContractRecord[], cccdImages: mappedImages,
    }));
  }

  async function read(db: Db, tenantId: string): Promise<AppResult<TenantListItem>> {
    const result = await db.from("tenants").select(tenantColumns).eq("id", tenantId).eq("owner_app_user_id", owner()).maybeSingle();
    if (result.error) return fail(result.error, "Could not read Tenant");
    if (!result.data) return tenantNotFound();
    const shown = await present(db, [result.data as TenantRecord]);
    return shown.error ? shown : ok(shown.data[0]);
  }

  async function roomExists(db: Db, roomId: string): Promise<AppResult<true>> {
    const result = await db.from("rooms").select("id").eq("id", roomId).eq("owner_app_user_id", owner()).maybeSingle();
    if (result.error) return fail(result.error, "Could not read Room");
    return result.data ? ok(true) : appError({ message: "Room was not found.", code: "ROOM_NOT_FOUND", statusCode: 404 });
  }

  const list = (roomId?: string, search?: string | null) => guarded(async () => {
    const db = await client();
    if (roomId) { const exists = await roomExists(db, roomId); if (exists.error) return exists; }
    let query = db.from("tenants").select(tenantColumns).eq("owner_app_user_id", owner());
    if (roomId) query = query.eq("room_id", roomId);
    if (search?.trim()) query = query.ilike("full_name", `%${search.trim()}%`);
    const rows = await query.order("full_name");
    if (rows.error) return fail(rows.error, "Could not read Tenants");
    return present(db, (rows.data ?? []) as TenantRecord[]);
  });

  return {
    listTenants(input) { return measure("repository.supabase.tenants-list", () => list(undefined, input?.search)); },
    listRoomTenants(roomId) { return measure("repository.supabase.room-tenants", () => list(roomId)); },
    readTenant(tenantId) { return measure("repository.supabase.tenant-detail", () => guarded(async () => read(await client(), tenantId))); },
    createTenant(input) { return measure("repository.supabase.tenant-create", () => guarded(async () => {
      const db = await client();
      const room = await roomExists(db, input.roomId);
      if (room.error) return room;
      const result = await db.from("tenants").insert({
        room_id: input.roomId, full_name: input.name, phone: input.phone,
        date_of_birth: input.dateOfBirth, permanent_address: input.permanentAddress,
        cccd_number: input.cccdNumber, status: input.status, is_key_tenant: false,
        owner_app_user_id: owner(),
      }).select("id").single();
      return result.error ? fail(result.error, "Could not create Tenant") : read(db, result.data.id);
    })); },
    updateTenant(input) { return measure("repository.supabase.tenant-update", () => guarded(async () => {
      const db = await client();
      const room = await roomExists(db, input.roomId);
      if (room.error) return room;
      const result = await db.from("tenants").update({
        room_id: input.roomId, full_name: input.name, phone: input.phone,
        date_of_birth: input.dateOfBirth, permanent_address: input.permanentAddress,
        cccd_number: input.cccdNumber, status: input.status, updated_at: new Date().toISOString(),
      }).eq("id", input.tenantId).eq("owner_app_user_id", owner()).select("id").maybeSingle();
      if (result.error) return fail(result.error, "Could not update Tenant");
      return result.data ? read(db, input.tenantId) : tenantNotFound();
    })); },
    deleteTenant(tenantId) { return measure("repository.supabase.tenant-delete", () => guarded(async () => {
      const db = await client();
      const current = await db.from("tenants").select("id,room_id").eq("id", tenantId).eq("owner_app_user_id", owner()).maybeSingle();
      if (current.error) return fail(current.error, "Could not read Tenant");
      if (!current.data) return tenantNotFound();
      const [contracts, images] = await Promise.all([
        db.from("contracts").select("id,status").eq("key_tenant_id", tenantId).eq("owner_app_user_id", owner()),
        db.from("tenant_cccd_images").select(imageColumns).eq("tenant_id", tenantId).eq("owner_app_user_id", owner()),
      ]);
      if (contracts.error || images.error) return fail(contracts.error || images.error, "Could not verify Tenant references");
      if (contracts.data?.length) return appError({ message: "Tenant is referenced by a Contract and cannot be deleted.", code: contracts.data.some((c) => c.status === "Active") ? "TENANT_ACTIVE_CONTRACT_REFERENCE" : "TENANT_CONTRACT_REFERENCE", statusCode: 409 });
      // Storage deletion must succeed before reporting a deleted Tenant. A failed DB delete is still an error.
      const keys = (images.data ?? []).map((image) => image.storage_key);
      if (keys.length) {
        const removed = await db.storage.from(tenantDocumentBucket).remove(keys);
        if (removed.error) return fail(removed.error, "Could not delete Tenant CCCD files");
      }
      const deleted = await db.from("tenants").delete().eq("id", tenantId).eq("owner_app_user_id", owner()).select("id,room_id").maybeSingle();
      if (deleted.error) return fail(deleted.error, "Could not delete Tenant");
      return deleted.data ? ok({ tenantId: deleted.data.id, roomId: deleted.data.room_id }) : tenantNotFound();
    })); },
    uploadTenantCccdImages(input) { return measure("repository.supabase.tenant-cccd-upload", () => guarded(async () => {
      const db = await client();
      const current = await read(db, input.tenantId);
      if (current.error) return current;
      const uploaded: string[] = [];
      const createdIds: string[] = [];
      for (const image of input.images) {
        const imageId = crypto.randomUUID();
        const safeName = image.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 80) || "image";
        const key = `${owner()}/${input.tenantId}/${imageId}-${safeName}`;
        const result = await db.storage.from(tenantDocumentBucket).upload(key, image, { contentType: image.type, upsert: false });
        if (result.error) { await compensateUpload(db, uploaded, createdIds); return fail(result.error, "Could not upload Tenant CCCD image"); }
        uploaded.push(key);
        const saved = await db.from("tenant_cccd_images").insert({ id: imageId, tenant_id: input.tenantId,
          storage_key: key, file_name: image.name, mime_type: image.type, file_size: image.size,
          owner_app_user_id: owner() }).select(imageColumns).single();
        if (saved.error) { await compensateUpload(db, uploaded, createdIds); return fail(saved.error, "Could not save Tenant CCCD image metadata"); }
        createdIds.push(imageId);
      }
      const shown = await read(db, input.tenantId);
      if (shown.error) return shown;
      return ok(shown.data.cccdImages.filter((image) => createdIds.includes(image.id)));
    })); },
    deleteTenantCccdImage(input) { return measure("repository.supabase.tenant-cccd-delete", () => guarded(async () => {
      const db = await client();
      const image = await db.from("tenant_cccd_images").select(imageColumns)
        .eq("id", input.imageId).eq("tenant_id", input.tenantId).eq("owner_app_user_id", owner()).maybeSingle();
      if (image.error) return fail(image.error, "Could not read Tenant CCCD image");
      if (!image.data) return imageNotFound();
      const removed = await db.storage.from(tenantDocumentBucket).remove([image.data.storage_key]);
      if (removed.error) return fail(removed.error, "Could not remove Tenant CCCD image from storage");
      const deleted = await db.from("tenant_cccd_images").delete().eq("id", input.imageId)
        .eq("tenant_id", input.tenantId).eq("owner_app_user_id", owner()).select("id").maybeSingle();
      if (deleted.error) return fail(deleted.error, "Could not delete Tenant CCCD image metadata");
      return deleted.data ? ok({ tenantId: input.tenantId, imageId: input.imageId }) : imageNotFound();
    })); },
  };
}

async function compensateUpload(db: Awaited<ReturnType<typeof createSupabaseServerClient>>, keys: string[], ids: string[]) {
  if (ids.length) await db.from("tenant_cccd_images").delete().in("id", ids);
  if (keys.length) await db.storage.from(tenantDocumentBucket).remove(keys);
}

const tenantNotFound = () => appError({ message: "Tenant was not found.", code: "TENANT_NOT_FOUND", statusCode: 404 });
const imageNotFound = () => appError({ message: "Tenant CCCD image was not found.", code: "TENANT_CCCD_IMAGE_NOT_FOUND", statusCode: 404 });
