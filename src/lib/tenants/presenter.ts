import type {
  ContractRecord,
  RoomRecord,
  TenantCccdImageRecord,
  TenantRecord,
} from "@/lib/insforge/types";

export type TenantCccdImage = {
  id: string;
  tenantId: string;
  url: string;
  storageKey: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
  source: "legacy" | "storage";
};

export type TenantListItem = {
  id: string;
  roomId: string | null;
  roomName: string | null;
  name: string;
  phone: string | null;
  dateOfBirth: string | null;
  permanentAddress: string | null;
  cccdNumber: string | null;
  cccdImages: TenantCccdImage[];
  status: TenantRecord["status"];
  isKeyTenant: boolean;
};

export const tenantStatusLabel: Record<TenantListItem["status"], string> = {
  Active: "Đang ở",
  "Moved Out": "Đã chuyển đi",
};

export function buildTenantList({
  tenants,
  activeContract,
  activeContracts,
  rooms = [],
  cccdImages = [],
}: {
  tenants: TenantRecord[];
  activeContract?: ContractRecord | null;
  activeContracts?: ContractRecord[];
  rooms?: Array<Pick<RoomRecord, "id" | "name">>;
  cccdImages?: TenantCccdImageRecord[];
}): TenantListItem[] {
  const roomNameById = new Map(rooms.map((room) => [room.id, room.name]));
  const keyTenantIds = new Set(
    [
      ...(activeContract ? [activeContract] : []),
      ...(activeContracts ?? []),
    ].map((contract) => contract.key_tenant_id),
  );
  const imagesByTenantId = groupCccdImagesByTenantId(cccdImages);

  return tenants
    .map((tenant) => ({
      id: tenant.id,
      roomId: tenant.room_id ?? null,
      roomName: tenant.room_id ? roomNameById.get(tenant.room_id) ?? null : null,
      name: tenant.full_name,
      phone: normalizeText(tenant.phone),
      dateOfBirth: normalizeText(tenant.date_of_birth),
      permanentAddress: normalizeText(tenant.permanent_address),
      cccdNumber: normalizeText(tenant.cccd_number),
      cccdImages: [
        ...buildLegacyCccdImages(tenant),
        ...(imagesByTenantId.get(tenant.id) ?? []),
      ],
      status: tenant.status,
      isKeyTenant: keyTenantIds.has(tenant.id),
    }))
    .sort(compareTenants);
}

function groupCccdImagesByTenantId(images: TenantCccdImageRecord[]) {
  const grouped = new Map<string, TenantCccdImage[]>();

  for (const image of images) {
    const current = grouped.get(image.tenant_id) ?? [];
    current.push({
      id: image.id,
      tenantId: image.tenant_id,
      url: image.public_url,
      storageKey: image.storage_key,
      fileName: image.file_name,
      mimeType: image.mime_type,
      fileSize: image.file_size === null ? null : Number(image.file_size),
      uploadedAt: image.created_at,
      source: "storage",
    });
    grouped.set(image.tenant_id, current);
  }

  return grouped;
}

function buildLegacyCccdImages(tenant: TenantRecord): TenantCccdImage[] {
  const images: TenantCccdImage[] = [];

  if (tenant.cccd_front_url) {
    images.push({
      id: `${tenant.id}-cccd-front`,
      tenantId: tenant.id,
      url: tenant.cccd_front_url,
      storageKey: null,
      fileName: "CCCD mặt trước",
      mimeType: null,
      fileSize: null,
      uploadedAt: null,
      source: "legacy",
    });
  }

  if (tenant.cccd_back_url) {
    images.push({
      id: `${tenant.id}-cccd-back`,
      tenantId: tenant.id,
      url: tenant.cccd_back_url,
      storageKey: null,
      fileName: "CCCD mặt sau",
      mimeType: null,
      fileSize: null,
      uploadedAt: null,
      source: "legacy",
    });
  }

  return images;
}

function compareTenants(left: TenantListItem, right: TenantListItem) {
  if (left.status !== right.status) {
    return left.status === "Active" ? -1 : 1;
  }

  if (left.isKeyTenant !== right.isKeyTenant) {
    return left.isKeyTenant ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

function normalizeText(value: string | null | undefined) {
  const cleaned = value?.trim();

  return cleaned ? cleaned : null;
}
