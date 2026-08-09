import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import {
  buildTenantList,
  type TenantCccdImage,
  type TenantListItem,
} from "@/lib/tenants/presenter";
import type {
  DeleteTenantCccdImageInput,
  DeleteTenantCccdImageResult,
  DeleteTenantResult,
  ListTenantsInput,
  TenantRepository,
  UpdateTenantInput,
  UploadTenantCccdImagesInput,
  WriteTenantInput,
} from "@/lib/tenants/repository";
import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import type {
  ContractRecord,
  RoomRecord,
  TenantCccdImageRecord,
  TenantRecord,
} from "./types";

type QueryResponse<T> = {
  data: T | null;
  error: unknown;
};

type StorageResponse<T> = {
  data: T | null;
  error: unknown;
};

type InsForgeServerClient = Awaited<ReturnType<typeof createInsForgeServerClient>>;

export function createInsForgeTenantRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): TenantRepository {
  let clientPromise: Promise<InsForgeServerClient> | null = null;
  const getClient = () => {
    clientPromise ??= createInsForgeServerClient();
    return clientPromise;
  };

  return {
    async listTenants(input) {
      const query = () => readTenantsFromInsForge({ input, getClient });

      return timer
        ? timer.measure("repository.insforge.tenants-directory-list", query)
        : query();
    },
    async listRoomTenants(roomId) {
      const query = () => readRoomTenantsFromInsForge({ roomId, getClient });

      return timer
        ? timer.measure("repository.insforge.tenants-list", query)
        : query();
    },
    async createTenant(input) {
      const query = () => createTenantInInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.tenant-create", query)
        : query();
    },
    async readTenant(tenantId) {
      const query = () => readTenantFromInsForge({ tenantId, getClient });

      return timer
        ? timer.measure("repository.insforge.tenant-detail", query)
        : query();
    },
    async updateTenant(input) {
      const query = () => updateTenantInInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.tenant-update", query)
        : query();
    },
    async deleteTenant(tenantId) {
      const query = () => deleteTenantInInsForge({ tenantId, getClient });

      return timer
        ? timer.measure("repository.insforge.tenant-delete", query)
        : query();
    },
    async uploadTenantCccdImages(input) {
      const query = () => uploadTenantCccdImagesToInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.tenant-cccd-upload", query)
        : query();
    },
    async deleteTenantCccdImage(input) {
      const query = () => deleteTenantCccdImageFromInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.tenant-cccd-delete", query)
        : query();
    },
  };
}

async function readTenantsFromInsForge({
  input,
  getClient,
}: {
  input?: ListTenantsInput;
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<TenantListItem[]>> {
  try {
    const client = await getClient();
    const tenantResult = await readTenantRows({ client, search: input?.search });

    if (tenantResult.error) {
      return tenantResult;
    }

    return buildTenantItems({ client, tenants: tenantResult.data });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readTenantFromInsForge({
  tenantId,
  getClient,
}: {
  tenantId: string;
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<TenantListItem>> {
  try {
    const client = await getClient();
    const response = (await client.database
      .from("tenants")
      .select(tenantSelect)
      .eq("id", tenantId)) as QueryResponse<TenantRecord[]>;

    if (response.error) {
      return fail(response.error, "Could not read Tenant");
    }

    const tenant = response.data?.[0];

    if (!tenant) {
      return tenantNotFound();
    }

    return buildSingleTenantItem({ client, tenant });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readRoomTenantsFromInsForge({
  roomId,
  getClient,
}: {
  roomId: string;
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<TenantListItem[]>> {
  try {
    const client = await getClient();
    const roomResult = await readRoomById({ client, roomId });

    if (roomResult.error) {
      return roomResult;
    }

    const tenants = await readTenantRowsForRoom({ client, roomId });

    if (tenants.error) {
      return tenants;
    }

    return buildTenantItems({ client, tenants: tenants.data, rooms: [roomResult.data] });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function createTenantInInsForge({
  roomId,
  name,
  phone,
  dateOfBirth,
  permanentAddress,
  cccdNumber,
  status,
  getClient,
}: WriteTenantInput & {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<TenantListItem>> {
  try {
    const client = await getClient();
    const roomResult = await readRoomById({ client, roomId });

    if (roomResult.error) {
      return roomResult;
    }

    const response = (await client.database
      .from("tenants")
      .insert({
        room_id: roomId,
        full_name: name,
        phone,
        date_of_birth: dateOfBirth,
        permanent_address: permanentAddress,
        cccd_number: cccdNumber,
        status,
        is_key_tenant: false,
      })
      .select(tenantSelect)) as QueryResponse<TenantRecord[]>;

    if (response.error) {
      return fail(response.error, "Could not create Tenant");
    }

    const tenant = response.data?.[0];

    if (!tenant) {
      return fail(new Error("Tenant create returned no rows"), "Could not create Tenant");
    }

    return buildSingleTenantItem({ client, tenant, rooms: [roomResult.data] });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function updateTenantInInsForge({
  tenantId,
  roomId,
  name,
  phone,
  dateOfBirth,
  permanentAddress,
  cccdNumber,
  status,
  getClient,
}: UpdateTenantInput & {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<TenantListItem>> {
  try {
    const client = await getClient();
    const [currentTenantResult, roomResult] = await Promise.all([
      readTenantById({ client, tenantId }),
      readRoomById({ client, roomId }),
    ]);

    if (currentTenantResult.error) {
      return currentTenantResult;
    }

    if (roomResult.error) {
      return roomResult;
    }

    const response = (await client.database
      .from("tenants")
      .update({
        room_id: roomId,
        full_name: name,
        phone,
        date_of_birth: dateOfBirth,
        permanent_address: permanentAddress,
        cccd_number: cccdNumber,
        status,
      })
      .eq("id", tenantId)
      .select(tenantSelect)) as QueryResponse<TenantRecord[]>;

    if (response.error) {
      return fail(response.error, "Could not update Tenant");
    }

    const tenant = response.data?.[0];

    if (!tenant) {
      return fail(new Error("Tenant update returned no rows"), "Could not update Tenant");
    }

    return buildSingleTenantItem({ client, tenant, rooms: [roomResult.data] });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function deleteTenantInInsForge({
  tenantId,
  getClient,
}: {
  tenantId: string;
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<DeleteTenantResult>> {
  try {
    const client = await getClient();
    const tenantResult = await readTenantById({ client, tenantId });

    if (tenantResult.error) {
      return tenantResult;
    }

    const contractReferences = await readContractsForTenant({ client, tenantId });

    if (contractReferences.error) {
      return contractReferences;
    }

    const activeReference = contractReferences.data.find(
      (contract) => contract.status === "Active",
    );

    if (activeReference) {
      return appError({
        message: "Tenant is the Key Tenant of an active Contract and cannot be deleted.",
        code: "TENANT_ACTIVE_CONTRACT_REFERENCE",
        statusCode: 409,
      });
    }

    if (contractReferences.data.length > 0) {
      return appError({
        message: "Tenant is referenced by a Contract and cannot be safely deleted.",
        code: "TENANT_CONTRACT_REFERENCE",
        statusCode: 409,
      });
    }

    const images = await readTenantCccdImages({ client, tenantIds: [tenantId] });

    if (images.error) {
      return images;
    }

    const response = (await client.database
      .from("tenants")
      .delete()
      .eq("id", tenantId)
      .select("id, room_id")) as QueryResponse<Array<Pick<TenantRecord, "id" | "room_id">>>;

    if (response.error) {
      return fail(response.error, "Could not delete Tenant");
    }

    const deleted = response.data?.[0];

    if (!deleted) {
      return tenantNotFound();
    }

    await removeTenantStorageObjects({ client, images: images.data });

    return ok({
      tenantId: deleted.id,
      roomId: deleted.room_id ?? null,
    });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function uploadTenantCccdImagesToInsForge({
  tenantId,
  images,
  getClient,
}: UploadTenantCccdImagesInput & {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<TenantCccdImage[]>> {
  try {
    const client = await getClient();
    const tenantResult = await readTenantById({ client, tenantId });

    if (tenantResult.error) {
      return tenantResult;
    }

    const uploadedRows: Omit<TenantCccdImageRecord, "id" | "created_at">[] = [];
    const bucket = client.storage.from(tenantCccdBucketName);

    for (const image of images) {
      const key = `${tenantId}/${crypto.randomUUID()}-${sanitizeStorageName(image.name)}`;
      const uploadResponse = (await bucket.upload(
        key,
        image,
      )) as StorageResponse<StorageUploadData>;

      if (uploadResponse.error || !uploadResponse.data) {
        return fail(uploadResponse.error, "Could not upload Tenant CCCD image");
      }

      uploadedRows.push({
        tenant_id: tenantId,
        storage_key: uploadResponse.data.key ?? key,
        public_url: readPublicUrl(bucket.getPublicUrl(key), uploadResponse.data.url),
        file_name: image.name,
        mime_type: image.type,
        file_size: image.size,
      });
    }

    const insertResponse = (await client.database
      .from("tenant_cccd_images")
      .insert(uploadedRows)
      .select(cccdImageSelect)) as QueryResponse<TenantCccdImageRecord[]>;

    if (insertResponse.error) {
      return fail(insertResponse.error, "Could not save Tenant CCCD image metadata");
    }

    return ok(
      (insertResponse.data ?? []).map((image) => ({
        id: image.id,
        tenantId: image.tenant_id,
        url: image.public_url,
        storageKey: image.storage_key,
        fileName: image.file_name,
        mimeType: image.mime_type,
        fileSize: image.file_size === null ? null : Number(image.file_size),
        uploadedAt: image.created_at,
        source: "storage",
      })),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function deleteTenantCccdImageFromInsForge({
  tenantId,
  imageId,
  getClient,
}: DeleteTenantCccdImageInput & {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<DeleteTenantCccdImageResult>> {
  try {
    const client = await getClient();
    const tenantResult = await readTenantById({ client, tenantId });

    if (tenantResult.error) {
      return tenantResult;
    }

    const imageResult = await readTenantCccdImageById({ client, tenantId, imageId });

    if (imageResult.error) {
      return imageResult;
    }

    const bucket = client.storage.from(tenantCccdBucketName);
    const removeResponse = (await bucket.remove([
      imageResult.data.storage_key,
    ])) as StorageResponse<unknown>;

    if (removeResponse.error) {
      return fail(removeResponse.error, "Could not delete Tenant CCCD image from storage");
    }

    const deleteResponse = (await client.database
      .from("tenant_cccd_images")
      .delete()
      .eq("id", imageId)
      .eq("tenant_id", tenantId)
      .select("id, tenant_id")) as QueryResponse<
      Array<Pick<TenantCccdImageRecord, "id" | "tenant_id">>
    >;

    if (deleteResponse.error) {
      return fail(deleteResponse.error, "Could not delete Tenant CCCD image metadata");
    }

    const deleted = deleteResponse.data?.[0];

    if (!deleted) {
      return tenantCccdImageNotFound();
    }

    return ok({
      tenantId: deleted.tenant_id,
      imageId: deleted.id,
    });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function buildSingleTenantItem({
  client,
  tenant,
  rooms,
}: {
  client: InsForgeServerClient;
  tenant: TenantRecord;
  rooms?: Array<Pick<RoomRecord, "id" | "name">>;
}): Promise<AppResult<TenantListItem>> {
  const result = await buildTenantItems({ client, tenants: [tenant], rooms });

  if (result.error) {
    return result;
  }

  const item = result.data[0];

  if (!item) {
    return fail(new Error("Tenant presenter returned no item"), "Could not read Tenant");
  }

  return ok(item);
}

async function buildTenantItems({
  client,
  tenants,
  rooms,
}: {
  client: InsForgeServerClient;
  tenants: TenantRecord[];
  rooms?: Array<Pick<RoomRecord, "id" | "name">>;
}): Promise<AppResult<TenantListItem[]>> {
  const roomIds = Array.from(
    new Set(tenants.map((tenant) => tenant.room_id).filter(isNonEmptyString)),
  );
  const tenantIds = tenants.map((tenant) => tenant.id);

  const [roomResult, activeContracts, cccdImages] = await Promise.all([
    rooms ? Promise.resolve(ok(rooms)) : readRoomsByIds({ client, roomIds }),
    readActiveContracts({ client }),
    readTenantCccdImages({ client, tenantIds }),
  ]);

  if (roomResult.error) {
    return roomResult;
  }

  if (activeContracts.error) {
    return activeContracts;
  }

  if (cccdImages.error) {
    return cccdImages;
  }

  return ok(
    buildTenantList({
      tenants,
      rooms: roomResult.data,
      activeContracts: activeContracts.data,
      cccdImages: cccdImages.data,
    }),
  );
}

async function readTenantById({
  client,
  tenantId,
}: {
  client: InsForgeServerClient;
  tenantId: string;
}): Promise<AppResult<TenantRecord>> {
  const response = (await client.database
    .from("tenants")
    .select(tenantSelect)
    .eq("id", tenantId)) as QueryResponse<TenantRecord[]>;

  if (response.error) {
    return fail(response.error, "Could not read Tenant");
  }

  const tenant = response.data?.[0];

  if (!tenant) {
    return tenantNotFound();
  }

  return ok(tenant);
}

async function readRoomById({
  client,
  roomId,
}: {
  client: InsForgeServerClient;
  roomId: string;
}): Promise<AppResult<Pick<RoomRecord, "id" | "name">>> {
  const response = (await client.database
    .from("rooms")
    .select("id, name")
    .eq("id", roomId)) as QueryResponse<Array<Pick<RoomRecord, "id" | "name">>>;

  if (response.error) {
    return fail(response.error, "Could not read Room");
  }

  const room = response.data?.[0];

  if (!room) {
    return appError({
      message: "Room was not found.",
      code: "ROOM_NOT_FOUND",
      statusCode: 404,
    });
  }

  return ok(room);
}

async function readTenantRows({
  client,
  search,
}: {
  client: InsForgeServerClient;
  search?: string | null;
}): Promise<AppResult<TenantRecord[]>> {
  let query = client.database.from("tenants").select(tenantSelect);

  if (search?.trim()) {
    query = query.ilike("full_name", `%${search.trim()}%`);
  }

  const response = (await query.order("full_name")) as QueryResponse<TenantRecord[]>;

  if (response.error) {
    return fail(response.error, "Could not read Tenants");
  }

  return ok((response.data ?? []) as unknown as TenantRecord[]);
}

async function readTenantRowsForRoom({
  client,
  roomId,
}: {
  client: InsForgeServerClient;
  roomId: string;
}): Promise<AppResult<TenantRecord[]>> {
  const response = (await client.database
    .from("tenants")
    .select(tenantSelect)
    .eq("room_id", roomId)
    .order("full_name")) as QueryResponse<TenantRecord[]>;

  if (response.error) {
    return fail(response.error, "Could not read Tenants");
  }

  return ok((response.data ?? []) as unknown as TenantRecord[]);
}

async function readRoomsByIds({
  client,
  roomIds,
}: {
  client: InsForgeServerClient;
  roomIds: string[];
}): Promise<AppResult<Array<Pick<RoomRecord, "id" | "name">>>> {
  if (roomIds.length === 0) {
    return ok([]);
  }

  const response = (await client.database
    .from("rooms")
    .select("id, name")
    .in("id", roomIds)) as QueryResponse<Array<Pick<RoomRecord, "id" | "name">>>;

  if (response.error) {
    return fail(response.error, "Could not read Rooms");
  }

  return ok(response.data ?? []);
}

async function readActiveContracts({
  client,
}: {
  client: InsForgeServerClient;
}): Promise<AppResult<ContractRecord[]>> {
  const response = (await client.database
    .from("contracts")
    .select(contractSelect)
    .eq("status", "Active")) as QueryResponse<ContractRecord[]>;

  if (response.error) {
    return fail(response.error, "Could not read active Contracts");
  }

  return ok((response.data ?? []) as unknown as ContractRecord[]);
}

async function readContractsForTenant({
  client,
  tenantId,
}: {
  client: InsForgeServerClient;
  tenantId: string;
}): Promise<AppResult<ContractRecord[]>> {
  const response = (await client.database
    .from("contracts")
    .select(contractSelect)
    .eq("key_tenant_id", tenantId)) as QueryResponse<ContractRecord[]>;

  if (response.error) {
    return fail(response.error, "Could not read Contracts for Tenant");
  }

  return ok((response.data ?? []) as unknown as ContractRecord[]);
}

async function readTenantCccdImages({
  client,
  tenantIds,
}: {
  client: InsForgeServerClient;
  tenantIds: string[];
}): Promise<AppResult<TenantCccdImageRecord[]>> {
  if (tenantIds.length === 0) {
    return ok([]);
  }

  const response = (await client.database
    .from("tenant_cccd_images")
    .select(cccdImageSelect)
    .in("tenant_id", tenantIds)
    .order("created_at", { ascending: false })) as QueryResponse<
    TenantCccdImageRecord[]
  >;

  if (response.error) {
    return fail(response.error, "Could not read Tenant CCCD images");
  }

  return ok((response.data ?? []) as unknown as TenantCccdImageRecord[]);
}

async function readTenantCccdImageById({
  client,
  tenantId,
  imageId,
}: {
  client: InsForgeServerClient;
  tenantId: string;
  imageId: string;
}): Promise<AppResult<TenantCccdImageRecord>> {
  const response = (await client.database
    .from("tenant_cccd_images")
    .select(cccdImageSelect)
    .eq("id", imageId)
    .eq("tenant_id", tenantId)) as QueryResponse<TenantCccdImageRecord[]>;

  if (response.error) {
    return fail(response.error, "Could not read Tenant CCCD image");
  }

  const image = response.data?.[0];

  if (!image) {
    return tenantCccdImageNotFound();
  }

  return ok(image);
}

async function removeTenantStorageObjects({
  client,
  images,
}: {
  client: InsForgeServerClient;
  images: TenantCccdImageRecord[];
}) {
  const keys = images.map((image) => image.storage_key).filter(isNonEmptyString);

  if (keys.length === 0) {
    return;
  }

  await client.storage.from(tenantCccdBucketName).remove(keys).catch(() => null);
}

function tenantNotFound() {
  return appError({
    message: "Tenant was not found.",
    code: "TENANT_NOT_FOUND",
    statusCode: 404,
  });
}

function tenantCccdImageNotFound() {
  return appError({
    message: "Tenant CCCD image was not found.",
    code: "TENANT_CCCD_IMAGE_NOT_FOUND",
    statusCode: 404,
  });
}

function sanitizeStorageName(name: string) {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "cccd-image";
}

function readPublicUrl(value: unknown, fallback?: string) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const data = "data" in value ? (value as { data?: unknown }).data : value;

    if (data && typeof data === "object") {
      if ("publicUrl" in data && typeof data.publicUrl === "string") {
        return data.publicUrl;
      }

      if ("url" in data && typeof data.url === "string") {
        return data.url;
      }
    }
  }

  return fallback ?? "";
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

type StorageUploadData = {
  key?: string;
  url?: string;
};

const tenantCccdBucketName = "tenant-cccd-images";

const tenantSelect = [
  "id",
  "room_id",
  "full_name",
  "phone",
  "date_of_birth",
  "permanent_address",
  "cccd_number",
  "is_key_tenant",
  "cccd_front_url",
  "cccd_back_url",
  "status",
].join(", ");

const contractSelect = [
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
].join(", ");

const cccdImageSelect = [
  "id",
  "tenant_id",
  "storage_key",
  "public_url",
  "file_name",
  "mime_type",
  "file_size",
  "created_at",
].join(", ");
