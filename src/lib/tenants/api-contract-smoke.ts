import type { ApiResponse } from "@/lib/api/response";
import type { TenantListItem } from "./presenter";

const authenticatedTenantListApiSmoke = {
  ok: true,
  data: [
    {
      id: "00000000-0000-0000-0000-000000000201",
      name: "Tenant Demo",
      phone: "0900000000",
      status: "Active",
      isKeyTenant: true,
    },
  ],
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

const authenticatedTenantDetailApiSmoke = {
  ok: true,
  data: {
    id: "00000000-0000-0000-0000-000000000201",
    name: "Tenant Demo",
    phone: "0900000000",
    status: "Active",
    isKeyTenant: true,
  },
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
    id: "00000000-0000-0000-0000-000000000202",
    name: "New Tenant",
    phone: "0911111111",
    status: "Active",
    isKeyTenant: false,
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
    id: "00000000-0000-0000-0000-000000000201",
    name: "Tenant Demo Updated",
    phone: "0922222222",
    status: "Moved Out",
    isKeyTenant: true,
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

export function getAuthenticatedTenantApiSmokeResponses() {
  return {
    list: authenticatedTenantListApiSmoke,
    detail: authenticatedTenantDetailApiSmoke,
    create: authenticatedTenantCreateApiSmoke,
    update: authenticatedTenantUpdateApiSmoke,
  };
}
