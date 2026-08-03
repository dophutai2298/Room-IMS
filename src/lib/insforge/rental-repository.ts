import "server-only";

import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import {
  buildRoomDetailView,
  buildRoomListItem,
  type RoomDetailView,
  type RoomListItem,
} from "@/lib/rooms/presenter";
import type {
  AppUser,
  ContractRecord,
  MvpSeededData,
  RoomRecord,
  TenantRecord,
} from "./types";

type QueryResponse<T> = {
  data: T | null;
  error: unknown;
};

export async function getCurrentAppUser(): Promise<AppResult<AppUser | null>> {
  try {
    const client = await createInsForgeServerClient();
    const currentUser = await client.auth.getCurrentUser();

    if (currentUser.error) {
      return fail(currentUser.error, "Could not resolve current InsForge user");
    }

    const user = currentUser.data?.user;

    if (!user) {
      return ok(null);
    }

    const profile = (user.profile ?? {}) as Record<string, unknown>;
    const roleResult = (await client.database
      .from("app_users")
      .select("id, auth_user_id, email, display_name, role")
      .eq("auth_user_id", user.id)
      .limit(1)) as QueryResponse<AppUserRow[]>;

    if (roleResult.error) {
      return fail(roleResult.error, "Could not resolve app user role");
    }

    const row = roleResult.data?.[0];

    if (!row) {
      return appError({
        message: "Signed-in InsForge user has no Landlord or Staff app_user role.",
        code: "APP_ROLE_NOT_CONFIGURED",
        statusCode: 403,
      });
    }

    return ok({
      id: row.id,
      authUserId: row.auth_user_id,
      email: row.email || user.email,
      displayName:
        row.display_name ||
        String(profile.displayName ?? profile.nickname ?? user.email),
      role: row.role,
    });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

export async function requireAppUserRole(): Promise<AppUser> {
  const result = await getCurrentAppUser();

  if (result.error) {
    throw new AppBackendException(result.error);
  }

  if (!result.data) {
    throw new AppBackendException({
      message: "Authentication required",
      code: "AUTH_REQUIRED",
      statusCode: 401,
    });
  }

  return result.data;
}

export async function readMvpSeededData(): Promise<AppResult<MvpSeededData>> {
  try {
    await requireAppUserRole();
    const client = await createInsForgeServerClient();

    const [rooms, tenants, contracts, utilityMetrics, utilityPricing, invoices] =
      await Promise.all([
        client.database.from("rooms").select("*").order("name"),
        client.database.from("tenants").select("*").order("full_name"),
        client.database.from("contracts").select("*").order("start_date"),
        client.database
          .from("utility_metrics")
          .select("*")
          .order("year")
          .order("month"),
        client.database
          .from("utility_pricing")
          .select("*")
          .eq("is_active", true)
          .order("effective_from"),
        client.database.from("invoices").select("*").order("year").order("month"),
      ]);

    for (const response of [
      rooms,
      tenants,
      contracts,
      utilityMetrics,
      utilityPricing,
      invoices,
    ]) {
      if (response.error) {
        return fail(response.error);
      }
    }

    return ok({
      rooms: (rooms.data ?? []) as RoomRecord[],
      tenants: tenants.data ?? [],
      contracts: contracts.data ?? [],
      utilityMetrics: utilityMetrics.data ?? [],
      utilityPricing: utilityPricing.data ?? [],
      invoices: invoices.data ?? [],
    });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

export async function readRoomsOverview(): Promise<AppResult<RoomListItem[]>> {
  try {
    await requireAppUserRole();
    const client = await createInsForgeServerClient();

    const [rooms, tenants, activeContracts] = await Promise.all([
      client.database.from("rooms").select("*").order("name"),
      client.database.from("tenants").select("*").order("full_name"),
      client.database
        .from("contracts")
        .select("*")
        .eq("status", "Active")
        .order("start_date"),
    ]);

    for (const response of [rooms, tenants, activeContracts]) {
      if (response.error) {
        return fail(response.error);
      }
    }

    const tenantRows = (tenants.data ?? []) as TenantRecord[];
    const activeContractRows = (activeContracts.data ?? []) as ContractRecord[];

    return ok(
      ((rooms.data ?? []) as RoomRecord[]).map((room) =>
        buildRoomListItem({
          room,
          tenants: tenantRows.filter((tenant) => tenant.room_id === room.id),
          activeContract:
            activeContractRows.find((contract) => contract.room_id === room.id) ?? null,
        }),
      ),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

export async function readRoomDetail(
  roomId: string,
): Promise<AppResult<RoomDetailView>> {
  try {
    await requireAppUserRole();
    const client = await createInsForgeServerClient();

    const [rooms, tenants, activeContracts] = await Promise.all([
      client.database.from("rooms").select("*").eq("id", roomId).limit(1),
      client.database
        .from("tenants")
        .select("*")
        .eq("room_id", roomId)
        .order("full_name"),
      client.database
        .from("contracts")
        .select("*")
        .eq("room_id", roomId)
        .eq("status", "Active")
        .order("start_date"),
    ]);

    for (const response of [rooms, tenants, activeContracts]) {
      if (response.error) {
        return fail(response.error);
      }
    }

    const room = ((rooms.data ?? []) as RoomRecord[])[0];

    if (!room) {
      return appError({
        message: "Room was not found.",
        code: "ROOM_NOT_FOUND",
        statusCode: 404,
      });
    }

    return ok(
      buildRoomDetailView({
        room,
        tenants: (tenants.data ?? []) as TenantRecord[],
        activeContract: ((activeContracts.data ?? []) as ContractRecord[])[0] ?? null,
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

export async function updateActiveContractKeyTenant({
  roomId,
  tenantId,
}: {
  roomId: string;
  tenantId: string;
}): Promise<AppResult<ContractRecord>> {
  try {
    await requireAppUserRole();
    const client = await createInsForgeServerClient();

    const tenantResponse = (await client.database
      .from("tenants")
      .select("id, room_id, full_name, phone, is_key_tenant, status")
      .eq("id", tenantId)
      .limit(1)) as QueryResponse<TenantRecord[]>;

    if (tenantResponse.error) {
      return fail(tenantResponse.error, "Could not verify selected tenant");
    }

    const tenant = tenantResponse.data?.[0];

    if (!tenant || tenant.room_id !== roomId) {
      return appError({
        message: "Key Tenant must belong to the same Room as the active Contract.",
        code: "KEY_TENANT_ROOM_MISMATCH",
        statusCode: 422,
      });
    }

    const contractResponse = (await client.database
      .from("contracts")
      .select("*")
      .eq("room_id", roomId)
      .eq("status", "Active")
      .limit(1)) as QueryResponse<ContractRecord[]>;

    if (contractResponse.error) {
      return fail(contractResponse.error, "Could not load active contract");
    }

    const activeContract = contractResponse.data?.[0];

    if (!activeContract) {
      return appError({
        message: "This Room has no active Contract to update.",
        code: "ACTIVE_CONTRACT_NOT_FOUND",
        statusCode: 409,
      });
    }

    const updateResponse = (await client.database
      .from("contracts")
      .update({ key_tenant_id: tenant.id })
      .eq("id", activeContract.id)
      .select()
      .limit(1)) as QueryResponse<ContractRecord[]>;

    if (updateResponse.error) {
      return fail(updateResponse.error, "Could not update Key Tenant");
    }

    const updatedContract = updateResponse.data?.[0];

    if (!updatedContract) {
      return fail(new Error("Contract update returned no rows"), "Could not update Key Tenant");
    }

    return ok(updatedContract);
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

export async function touchRoom(roomId: string): Promise<AppResult<RoomRecord>> {
  try {
    await requireAppUserRole();
    const client = await createInsForgeServerClient();
    const response = (await client.database
      .from("rooms")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", roomId)
      .select()
      .limit(1)) as QueryResponse<RoomRecord[]>;

    if (response.error) {
      return fail(response.error, "Could not write room update");
    }

    const room = response.data?.[0];

    if (!room) {
      return fail(new Error(`Room ${roomId} was not found`), "Room was not found");
    }

    return ok(room);
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

class AppBackendException extends Error {
  statusCode?: number;
  error: string;
  nextActions?: string;

  constructor(error: {
    message: string;
    code: string;
    statusCode?: number;
    nextActions?: string;
  }) {
    super(error.message);
    this.name = "AppBackendException";
    this.statusCode = error.statusCode;
    this.error = error.code;
    this.nextActions = error.nextActions;
  }
}

type AppUserRow = {
  id: string;
  auth_user_id: string;
  email: string;
  display_name: string;
  role: "landlord" | "staff";
};
