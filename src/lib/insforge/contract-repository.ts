import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import {
  buildContractList,
  type ContractListItem,
} from "@/lib/contracts/presenter";
import type {
  ContractRepository,
  CreateContractInput,
  UpdateContractInput,
} from "@/lib/contracts/repository";
import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import type { ContractRecord, TenantRecord } from "./types";

type QueryResponse<T> = {
  data: T | null;
  error: unknown;
};

type InsForgeServerClient = Awaited<ReturnType<typeof createInsForgeServerClient>>;

export function createInsForgeContractRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): ContractRepository {
  let clientPromise: Promise<InsForgeServerClient> | null = null;
  const getClient = () => {
    clientPromise ??= createInsForgeServerClient();
    return clientPromise;
  };

  return {
    async listRoomContracts(roomId) {
      const query = () => listRoomContractsFromInsForge({ roomId, getClient });

      return timer
        ? timer.measure("repository.insforge.contracts-list", query)
        : query();
    },
    async createContract(input) {
      const query = () => createContractInInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.contract-create", query)
        : query();
    },
    async updateContract(input) {
      const query = () => updateContractInInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.contract-update", query)
        : query();
    },
  };
}

async function listRoomContractsFromInsForge({
  roomId,
  getClient,
}: {
  roomId: string;
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<ContractListItem[]>> {
  try {
    const client = await getClient();
    const [roomResponse, contractResponse, tenantResponse] = await Promise.all([
      client.database
        .from("rooms")
        .select("id, base_price")
        .eq("id", roomId)
        .limit(1),
      client.database
        .from("contracts")
        .select(contractSelect)
        .eq("room_id", roomId)
        .order("start_date"),
      client.database
        .from("tenants")
        .select(tenantSelect)
        .eq("room_id", roomId)
        .order("full_name"),
    ]);

    for (const response of [roomResponse, contractResponse, tenantResponse]) {
      if (response.error) {
        return fail(response.error, "Could not read Contracts");
      }
    }

    const room = roomResponse.data?.[0] as
      | { id: string; base_price: number | string }
      | undefined;

    if (!room) {
      return roomNotFound();
    }

    return ok(
      buildContractList({
        contracts: (contractResponse.data ?? []) as unknown as ContractRecord[],
        tenants: (tenantResponse.data ?? []) as unknown as TenantRecord[],
        roomBasePrice: Number(room.base_price),
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function createContractInInsForge({
  getClient,
  ...input
}: CreateContractInput & {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<ContractListItem>> {
  try {
    const client = await getClient();
    const [roomResponse, tenantResponse, activeContractResponse] =
      await Promise.all([
        client.database
          .from("rooms")
          .select("id")
          .eq("id", input.roomId)
          .limit(1),
        client.database
          .from("tenants")
          .select(tenantSelect)
          .eq("id", input.keyTenantId)
          .limit(1),
        client.database
          .from("contracts")
          .select("id")
          .eq("room_id", input.roomId)
          .eq("status", "Active")
          .limit(1),
      ]);

    for (const response of [
      roomResponse,
      tenantResponse,
      activeContractResponse,
    ]) {
      if (response.error) {
        return fail(response.error, "Could not verify Contract relationships");
      }
    }

    if (!roomResponse.data?.[0]) {
      return roomNotFound();
    }

    const tenant = (tenantResponse.data?.[0] ?? null) as TenantRecord | null;
    const tenantValidation = validateKeyTenant({
      tenant,
      roomId: input.roomId,
      requireActive: true,
    });

    if (tenantValidation.error) {
      return tenantValidation;
    }

    if (activeContractResponse.data?.[0]) {
      return activeContractConflict();
    }

    const response = (await client.database
      .from("contracts")
      .insert(contractWriteValues({ ...input, status: "Active" }))
      .select(contractSelect)) as QueryResponse<ContractRecord[]>;

    if (response.error) {
      return contractWriteFailure(response.error, "Could not create Contract");
    }

    const contract = response.data?.[0];

    if (!contract) {
      return fail(
        new Error("Contract create returned no rows"),
        "Could not create Contract",
      );
    }

    return ok(
      buildContractList({
        contracts: [contract],
        tenants: [tenantValidation.data],
      })[0],
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function updateContractInInsForge({
  getClient,
  ...input
}: UpdateContractInput & {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<ContractListItem>> {
  try {
    const client = await getClient();
    const currentResponse = (await client.database
      .from("contracts")
      .select(contractSelect)
      .eq("id", input.contractId)
      .limit(1)) as QueryResponse<ContractRecord[]>;

    if (currentResponse.error) {
      return fail(currentResponse.error, "Could not read Contract");
    }

    const currentContract = currentResponse.data?.[0];

    if (!currentContract) {
      return contractNotFound();
    }

    const [tenantResponse, activeContractResponse] = await Promise.all([
      client.database
        .from("tenants")
        .select(tenantSelect)
        .eq("id", input.keyTenantId)
        .limit(1),
      client.database
        .from("contracts")
        .select("id")
        .eq("room_id", currentContract.room_id)
        .eq("status", "Active"),
    ]);

    for (const response of [tenantResponse, activeContractResponse]) {
      if (response.error) {
        return fail(response.error, "Could not verify Contract relationships");
      }
    }

    const tenant = (tenantResponse.data?.[0] ?? null) as TenantRecord | null;
    const tenantValidation = validateKeyTenant({
      tenant,
      roomId: currentContract.room_id,
      requireActive: input.status === "Active",
    });

    if (tenantValidation.error) {
      return tenantValidation;
    }

    const otherActiveContract = activeContractResponse.data?.find(
      (contract: { id: string }) => contract.id !== input.contractId,
    );

    if (input.status === "Active" && otherActiveContract) {
      return activeContractConflict();
    }

    const response = (await client.database
      .from("contracts")
      .update(
        contractWriteValues({
          ...input,
          roomId: currentContract.room_id,
        }),
      )
      .eq("id", input.contractId)
      .select(contractSelect)) as QueryResponse<ContractRecord[]>;

    if (response.error) {
      return contractWriteFailure(response.error, "Could not update Contract");
    }

    const contract = response.data?.[0];

    if (!contract) {
      return contractNotFound();
    }

    return ok(
      buildContractList({
        contracts: [contract],
        tenants: [tenantValidation.data],
      })[0],
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

function contractWriteValues({
  roomId,
  keyTenantId,
  depositAmount,
  rentAmount,
  electricityPriceOverride,
  waterPriceOverride,
  startDate,
  endDate,
  status,
}: CreateContractInput & { status: ContractRecord["status"] }) {
  return {
    room_id: roomId,
    key_tenant_id: keyTenantId,
    deposit_amount: depositAmount,
    rent_amount: rentAmount,
    electricity_price_override: electricityPriceOverride,
    water_price_override: waterPriceOverride,
    start_date: startDate,
    end_date: endDate,
    status,
    updated_at: new Date().toISOString(),
  };
}

function validateKeyTenant({
  tenant,
  roomId,
  requireActive,
}: {
  tenant: TenantRecord | null;
  roomId: string;
  requireActive: boolean;
}): AppResult<TenantRecord> {
  if (!tenant || tenant.room_id !== roomId) {
    return appError({
      message: "Key Tenant must belong to the same Room as the Contract.",
      code: "KEY_TENANT_ROOM_MISMATCH",
      statusCode: 422,
    });
  }

  if (requireActive && tenant.status !== "Active") {
    return appError({
      message: "An active Contract requires an active Key Tenant.",
      code: "KEY_TENANT_NOT_ACTIVE",
      statusCode: 422,
    });
  }

  return ok(tenant);
}

function contractWriteFailure(error: unknown, fallback: string) {
  if (hasDatabaseCode(error, "23505")) {
    return activeContractConflict();
  }

  if (hasDatabaseCode(error, "P0001")) {
    return appError({
      message: "Key Tenant must belong to the same Room as the Contract.",
      code: "KEY_TENANT_ROOM_MISMATCH",
      statusCode: 422,
    });
  }

  return fail(error, fallback);
}

function hasDatabaseCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String(error.code) === code
  );
}

function roomNotFound() {
  return appError({
    message: "Room was not found.",
    code: "ROOM_NOT_FOUND",
    statusCode: 404,
  });
}

function contractNotFound() {
  return appError({
    message: "Contract was not found.",
    code: "CONTRACT_NOT_FOUND",
    statusCode: 404,
  });
}

function activeContractConflict() {
  return appError({
    message: "This Room already has an active Contract.",
    code: "ACTIVE_CONTRACT_ALREADY_EXISTS",
    statusCode: 409,
  });
}

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

const tenantSelect = [
  "id",
  "room_id",
  "full_name",
  "phone",
  "is_key_tenant",
  "status",
].join(", ");
