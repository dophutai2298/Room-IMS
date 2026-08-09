import type { ApiResponse } from "@/lib/api/response";
import type { TenantCccdImage, TenantListItem } from "./presenter";
import type { DeleteTenantCccdImageResult, DeleteTenantResult } from "./repository";

const tenantDemo = {
  id: "00000000-0000-0000-0000-000000000201",
  roomId: "00000000-0000-0000-0000-000000000101",
  roomName: "Room 101",
  name: "Tenant Demo",
  phone: "0900000000",
  dateOfBirth: "22/02/1998",
  permanentAddress: "TP Ho Chi Minh",
  cccdNumber: "079000000001",
  cccdImages: [
    {
      id: "00000000-0000-0000-0000-000000000901",
      tenantId: "00000000-0000-0000-0000-000000000201",
      url: "https://storage.local/tenant-cccd-images/demo.jpg",
      storageKey: "tenant/demo.jpg",
      fileName: "demo.jpg",
      mimeType: "image/jpeg",
      fileSize: 1000,
      uploadedAt: "2026-08-09T00:00:00.000Z",
      source: "storage",
    },
  ],
  status: "Active",
  isKeyTenant: true,
} satisfies TenantListItem;

const authenticatedTenantListApiSmoke = {
  ok: true,
  data: [tenantDemo],
  meta: {
    timing: {
      operation: "tenants.list",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.tenants-list", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<TenantListItem[]>;

const authenticatedTenantDirectoryApiSmoke = {
  ok: true,
  data: [tenantDemo],
  meta: {
    timing: {
      operation: "tenants.directory.list",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.tenants-directory-list", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<TenantListItem[]>;

const authenticatedTenantDetailApiSmoke = {
  ok: true,
  data: tenantDemo,
  meta: {
    timing: {
      operation: "tenants.detail",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.tenant-detail", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<TenantListItem>;

const authenticatedTenantCreateApiSmoke = {
  ok: true,
  data: {
    ...tenantDemo,
    id: "00000000-0000-0000-0000-000000000202",
    name: "New Tenant",
    phone: "0911111111",
    isKeyTenant: false,
    cccdImages: [],
  },
  meta: {
    timing: {
      operation: "tenants.create",
      totalMs: 1,
      spans: [
        { name: "validation", durationMs: 1 },
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.tenant-create", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<TenantListItem>;

const authenticatedTenantUpdateApiSmoke = {
  ok: true,
  data: {
    ...tenantDemo,
    name: "Tenant Demo Updated",
    phone: "0922222222",
    status: "Moved Out",
  },
  meta: {
    timing: {
      operation: "tenants.update",
      totalMs: 1,
      spans: [
        { name: "validation", durationMs: 1 },
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.tenant-update", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<TenantListItem>;

const authenticatedTenantDeleteApiSmoke = {
  ok: true,
  data: {
    tenantId: tenantDemo.id,
    roomId: tenantDemo.roomId,
  },
  meta: {
    timing: {
      operation: "tenants.delete",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.tenant-delete", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<DeleteTenantResult>;

const authenticatedTenantCccdUploadApiSmoke = {
  ok: true,
  data: tenantDemo.cccdImages,
  meta: {
    timing: {
      operation: "tenants.cccd-images.upload",
      totalMs: 1,
      spans: [
        { name: "validation", durationMs: 1 },
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.tenant-cccd-upload", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<TenantCccdImage[]>;

const authenticatedTenantCccdDeleteApiSmoke = {
  ok: true,
  data: {
    tenantId: tenantDemo.id,
    imageId: tenantDemo.cccdImages[0].id,
  },
  meta: {
    timing: {
      operation: "tenants.cccd-images.delete",
      totalMs: 1,
      spans: [
        { name: "auth", durationMs: 1 },
        { name: "service", durationMs: 1 },
        { name: "repository.insforge.tenant-cccd-delete", durationMs: 1 },
      ],
    },
  },
} satisfies ApiResponse<DeleteTenantCccdImageResult>;

export function getAuthenticatedTenantApiSmokeResponses() {
  return {
    list: authenticatedTenantListApiSmoke,
    directory: authenticatedTenantDirectoryApiSmoke,
    detail: authenticatedTenantDetailApiSmoke,
    create: authenticatedTenantCreateApiSmoke,
    update: authenticatedTenantUpdateApiSmoke,
    delete: authenticatedTenantDeleteApiSmoke,
    cccdUpload: authenticatedTenantCccdUploadApiSmoke,
    cccdDelete: authenticatedTenantCccdDeleteApiSmoke,
  };
}
