import "server-only";

import type { AppResult } from "@/lib/insforge/errors";
import type { TenantCccdImage, TenantListItem } from "./presenter";
import type {
  DeleteTenantResult,
  TenantRepository,
  UpdateTenantInput,
  WriteTenantInput,
} from "./repository";
import {
  createTenantForOperations,
  deleteTenantForOperations,
  getTenantForOperations,
  listRoomTenantsForOperations,
  listTenantsForOperations,
  updateTenantForOperations,
  uploadTenantCccdImagesForOperations,
} from "./service";

export async function runTenantServiceBehaviorSmoke() {
  const repository = createSmokeRepository();

  return {
    listTenants: await listRoomTenantsForOperations({
      repository,
      roomId,
    }),
    searchTenants: await listTenantsForOperations({
      repository,
      search: "demo",
    }),
    readTenant: await getTenantForOperations({
      repository,
      tenantId: keyTenant.id,
    }),
    createTenant: await createTenantForOperations({
      repository,
      roomId,
      name: " New Tenant ",
      phone: " 0911111111 ",
      dateOfBirth: "22/02/1998",
      permanentAddress: "TP Ho Chi Minh",
      cccdNumber: " 079000000001 ",
      status: "Active",
    }),
    updateTenant: await updateTenantForOperations({
      repository,
      tenantId: keyTenant.id,
      roomId,
      name: "Tenant Demo Updated",
      phone: "0922222222",
      dateOfBirth: "23/02/1998",
      permanentAddress: "Dong Nai",
      cccdNumber: "079000000009",
      status: "Moved Out",
    }),
    uploadCccdImages: await uploadTenantCccdImagesForOperations({
      repository,
      tenantId: keyTenant.id,
      images: [smokeImage],
    }),
    deleteSafeTenant: await deleteTenantForOperations({
      repository,
      tenantId: safeTenant.id,
    }),
    rejectMissingName: await createTenantForOperations({
      repository,
      roomId,
      name: "",
      phone: "0911111111",
      dateOfBirth: null,
      permanentAddress: null,
      cccdNumber: "079000000001",
      status: "Active",
    }),
    rejectMissingPhone: await createTenantForOperations({
      repository,
      roomId,
      name: "Tenant Demo",
      phone: "",
      dateOfBirth: null,
      permanentAddress: null,
      cccdNumber: "079000000001",
      status: "Active",
    }),
    rejectMissingCccdNumber: await createTenantForOperations({
      repository,
      roomId,
      name: "Tenant Demo",
      phone: "0911111111",
      dateOfBirth: null,
      permanentAddress: null,
      cccdNumber: "",
      status: "Active",
    }),
    rejectInvalidStatus: await updateTenantForOperations({
      repository,
      tenantId: keyTenant.id,
      roomId,
      name: "Tenant Demo",
      phone: "0911111111",
      dateOfBirth: null,
      permanentAddress: null,
      cccdNumber: "079000000001",
      status: "Invalid" as "Active",
    }),
    rejectActiveKeyTenantDelete: await deleteTenantForOperations({
      repository,
      tenantId: keyTenant.id,
    }),
  };
}

function createSmokeRepository(): TenantRepository {
  return {
    async listTenants() {
      return ok([keyTenant, safeTenant]);
    },
    async listRoomTenants() {
      return ok([keyTenant, safeTenant]);
    },
    async readTenant() {
      return ok(keyTenant);
    },
    async createTenant(input) {
      return ok(createTenantItem(input));
    },
    async updateTenant(input) {
      return ok(updateTenantItem(input));
    },
    async deleteTenant(tenantId) {
      if (tenantId === keyTenant.id) {
        return {
          data: null,
          error: {
            message: "Tenant is the Key Tenant of an active Contract and cannot be deleted.",
            code: "TENANT_ACTIVE_CONTRACT_REFERENCE",
            statusCode: 409,
          },
        };
      }

      return ok({ tenantId, roomId } satisfies DeleteTenantResult);
    },
    async uploadTenantCccdImages() {
      return ok([smokeCccdImage]);
    },
  };
}

const roomId = "00000000-0000-0000-0000-000000000101";

const smokeCccdImage: TenantCccdImage = {
  id: "00000000-0000-0000-0000-000000000901",
  tenantId: "00000000-0000-0000-0000-000000000201",
  url: "https://storage.local/tenant-cccd-images/demo.jpg",
  storageKey: "tenant/demo.jpg",
  fileName: "demo.jpg",
  mimeType: "image/jpeg",
  fileSize: 1000,
  uploadedAt: "2026-08-09T00:00:00.000Z",
  source: "storage",
};

const keyTenant: TenantListItem = {
  id: "00000000-0000-0000-0000-000000000201",
  roomId,
  roomName: "Room 101",
  name: "Tenant Demo",
  phone: "0900000000",
  dateOfBirth: "22/02/1998",
  permanentAddress: "TP Ho Chi Minh",
  cccdNumber: "079000000001",
  cccdImages: [smokeCccdImage],
  status: "Active",
  isKeyTenant: true,
};

const safeTenant: TenantListItem = {
  ...keyTenant,
  id: "00000000-0000-0000-0000-000000000202",
  name: "Safe Tenant",
  isKeyTenant: false,
};

const smokeImage = {
  name: "demo.jpg",
  size: 1000,
  type: "image/jpeg",
} as File;

function createTenantItem(input: WriteTenantInput): TenantListItem {
  return {
    id: "00000000-0000-0000-0000-000000000203",
    roomId: input.roomId,
    roomName: "Room 101",
    name: input.name,
    phone: input.phone,
    dateOfBirth: input.dateOfBirth,
    permanentAddress: input.permanentAddress,
    cccdNumber: input.cccdNumber,
    cccdImages: [],
    status: input.status,
    isKeyTenant: false,
  };
}

function updateTenantItem(input: UpdateTenantInput): TenantListItem {
  return {
    ...keyTenant,
    id: input.tenantId,
    roomId: input.roomId,
    name: input.name,
    phone: input.phone,
    dateOfBirth: input.dateOfBirth,
    permanentAddress: input.permanentAddress,
    cccdNumber: input.cccdNumber,
    status: input.status,
  };
}

function ok<T>(data: T): AppResult<T> {
  return {
    data,
    error: null,
  };
}
