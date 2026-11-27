import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { appError, fail, ok, type AppResult, toAppBackendError } from "@/lib/insforge/errors";
import type { ContractRecord, RoomRecord, TenantCccdImageRecord, TenantRecord } from "@/lib/insforge/types";
import { getActiveOwnerAppUserId } from "@/lib/server/operational-owner-scope";
import { buildTenantList, type TenantListItem } from "@/lib/tenants/presenter";
import type { TenantRepository } from "@/lib/tenants/repository";
import { createSupabaseAdminClient } from "./admin";
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
      // Legacy URLs are retained for historical reconciliation but must never leak
      // into a Supabase response; imported files are represented by private metadata.
      tenants: tenants.map((tenant) => ({ ...tenant, cccd_front_url: null, cccd_back_url: null })),
      rooms: rooms.data ?? [],
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
      const keys = (images.data ?? []).map((image) => image.storage_key);
      if (keys.length) return appError({
        message: "Remove the Tenant's CCCD images before deleting the Tenant.",
        code: "TENANT_CCCD_IMAGES_MUST_BE_REMOVED", statusCode: 409,
      });
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
        if (result.error) {
          if (!await compensateUpload(uploaded, createdIds)) return imageRecoveryRequired();
          return fail(result.error, "Could not upload Tenant CCCD image");
        }
        uploaded.push(key);
        const saved = await db.from("tenant_cccd_images").insert({ id: imageId, tenant_id: input.tenantId,
          storage_key: key, file_name: image.name, mime_type: image.type, file_size: image.size,
          owner_app_user_id: owner() }).select(imageColumns).single();
        if (saved.error) {
          if (!await compensateUpload(uploaded, createdIds)) return imageRecoveryRequired();
          return fail(saved.error, "Could not save Tenant CCCD image metadata");
        }
        createdIds.push(imageId);
      }
      const shown = await read(db, input.tenantId);
      if (shown.error) return shown;
      return ok(shown.data.cccdImages.filter((image) => createdIds.includes(image.id)));
    })); },
    deleteTenantCccdImage(input) { return measure("repository.supabase.tenant-cccd-delete", () => guarded(async () => {
      const db = await client();
      const image = await db.from("tenant_cccd_images").select("*")
        .eq("id", input.imageId).eq("tenant_id", input.tenantId).eq("owner_app_user_id", owner()).maybeSingle();
      if (image.error) return fail(image.error, "Could not read Tenant CCCD image");
      if (!image.data) return imageNotFound();
      const original = await db.storage.from(tenantDocumentBucket).download(image.data.storage_key);
      if (original.error || !original.data) return fail(original.error, "Could not back up Tenant CCCD image before deletion");
      const removed = await db.storage.from(tenantDocumentBucket).remove([image.data.storage_key]);
      // Storage can report success when a policy silently filtered the requested path.
      // list() uses POST, avoiding a cached repeat of the pre-delete download in Next.
      const lastSlash = image.data.storage_key.lastIndexOf("/");
      const folder = image.data.storage_key.slice(0, lastSlash);
      const fileName = image.data.storage_key.slice(lastSlash + 1);
      const remaining = removed.error ? null : await db.storage.from(tenantDocumentBucket)
        .list(folder, { search: fileName, limit: 100 });
      const deletedPathReturned = removed.data?.some((entry) => entry.name === image.data.storage_key);
      if (removed.error || !deletedPathReturned || remaining?.error || !remaining?.data
        || remaining.data.some((entry) => entry.name === fileName)) {
        if (!await restoreImageObject(image.data.storage_key, original.data, image.data.mime_type)) return imageRecoveryRequired();
        return removed.error ? fail(removed.error, "Could not remove Tenant CCCD image from storage")
          : appError({ message: "Could not verify Tenant CCCD image removal from storage.", code: "TENANT_CCCD_DELETE_UNVERIFIED", statusCode: 502 });
      }
      const deleted = await db.from("tenant_cccd_images").delete().eq("id", input.imageId)
        .eq("tenant_id", input.tenantId).eq("owner_app_user_id", owner()).select("id").maybeSingle();
      if (deleted.error || !deleted.data) {
        if (!await restoreImageObject(image.data.storage_key, original.data, image.data.mime_type)) return imageRecoveryRequired();
        return deleted.error ? fail(deleted.error, "Could not delete Tenant CCCD image metadata") : imageNotFound();
      }
      return ok({ tenantId: input.tenantId, imageId: input.imageId });
    })); },
  };
}

async function compensateUpload(keys: string[], ids: string[]): Promise<boolean> {
  if (!keys.length && !ids.length) return true;
  try {
    // Only request-local keys/IDs are passed here. Staff cannot delete persistent documents.
    const admin = createSupabaseAdminClient();
    if (keys.length) {
      const removed = await admin.storage.from(tenantDocumentBucket).remove(keys);
      if (removed.error || !keys.every((key) => removed.data?.some((entry) => entry.name === key))) return false;
      for (const key of keys) {
        const stillThere = await admin.storage.from(tenantDocumentBucket).download(key);
        if (stillThere.data || stillThere.error?.statusCode !== "404") return false;
      }
    }
    if (ids.length) {
      const deleted = await admin.from("tenant_cccd_images").delete().in("id", ids);
      if (deleted.error) return false;
      const remaining = await admin.from("tenant_cccd_images").select("id").in("id", ids);
      if (remaining.error || remaining.data?.length) return false;
    }
    return true;
  } catch { return false; }
}

async function restoreImageObject(key: string, bytes: Blob, mimeType: string | null): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient();
    const uploaded = await admin.storage.from(tenantDocumentBucket).upload(key, bytes,
      { contentType: mimeType || "application/octet-stream", upsert: true });
    if (uploaded.error) return false;
    const verified = await admin.storage.from(tenantDocumentBucket).download(key);
    return !verified.error && !!verified.data
      && Buffer.from(await verified.data.arrayBuffer()).equals(Buffer.from(await bytes.arrayBuffer()));
  } catch { return false; }
}

const tenantNotFound = () => appError({ message: "Tenant was not found.", code: "TENANT_NOT_FOUND", statusCode: 404 });
const imageNotFound = () => appError({ message: "Tenant CCCD image was not found.", code: "TENANT_CCCD_IMAGE_NOT_FOUND", statusCode: 404 });
const imageRecoveryRequired = () => appError({ message: "CCCD image cleanup could not be verified; administrator recovery is required.", code: "TENANT_CCCD_RECOVERY_REQUIRED", statusCode: 500 });
