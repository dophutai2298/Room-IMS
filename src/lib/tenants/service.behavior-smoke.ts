import "server-only";

import type { AppResult } from "@/lib/insforge/errors";
import type { TenantListItem } from "./presenter";
import type {
  TenantRepository,
  UpdateTenantInput,
  WriteTenantInput,
} from "./repository";
import {
  createTenantForOperations,
  getTenantForOperations,
  listRoomTenantsForOperations,
  updateTenantForOperations,
} from "./service";

export async function runTenantServiceBehaviorSmoke() {
  const repository = createSmokeRepository();

  return {
    listTenants: await listRoomTenantsForOperations({
      repository,
      roomId,
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
      status: "Active",
    }),
    updateTenant: await updateTenantForOperations({
      repository,
      tenantId: keyTenant.id,
      name: "Tenant Demo Updated",
      phone: "0922222222",
      status: "Moved Out",
    }),
    rejectMissingName: await createTenantForOperations({
      repository,
      roomId,
      name: "",
      phone: null,
      status: "Active",
    }),
    rejectInvalidStatus: await updateTenantForOperations({
      repository,
      tenantId: keyTenant.id,
      name: "Tenant Demo",
      phone: null,
      status: "Invalid" as "Active",
    }),
  };
}

function createSmokeRepository(): TenantRepository {
  return {
    async listRoomTenants() {
      return ok([keyTenant]);
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
  };
}

const roomId = "00000000-0000-0000-0000-000000000101";

const keyTenant: TenantListItem = {
  id: "00000000-0000-0000-0000-000000000201",
  name: "Tenant Demo",
  phone: "0900000000",
  status: "Active",
  isKeyTenant: true,
};

function createTenantItem(input: WriteTenantInput): TenantListItem {
  return {
    id: "00000000-0000-0000-0000-000000000202",
    name: input.name,
    phone: input.phone,
    status: input.status,
    isKeyTenant: false,
  };
}

function updateTenantItem(input: UpdateTenantInput): TenantListItem {
  return {
    ...keyTenant,
    id: input.tenantId,
    name: input.name,
    phone: input.phone,
    status: input.status,
  };
}

function ok<T>(data: T): AppResult<T> {
  return {
    data,
    error: null,
  };
}
