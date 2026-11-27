import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { buildContractList } from "@/lib/contracts/presenter";
import type { ContractRepository, CreateContractInput, UpdateContractInput } from "@/lib/contracts/repository";
import { appError, fail, ok, type AppResult, toAppBackendError } from "@/lib/insforge/errors";
import type { ContractRecord, TenantRecord } from "@/lib/insforge/types";
import { getActiveOwnerAppUserId } from "@/lib/server/operational-owner-scope";
import { createSupabaseServerClient } from "./server";

const contractColumns = "id,room_id,key_tenant_id,deposit_amount,rent_amount,electricity_price_override,water_price_override,start_date,end_date,status,owner_app_user_id";

export function createSupabaseContractRepository({ timer }: { timer?: ApiTimer } = {}): ContractRepository {
  type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;
  let promise: Promise<Db> | undefined;
  const client = () => (promise ??= createSupabaseServerClient());
  const owner = () => getActiveOwnerAppUserId();
  const run = async <T>(name: string, fn: () => Promise<AppResult<T>>): Promise<AppResult<T>> => {
    const guarded = async () => { try { return await fn(); } catch (error) { return { data: null, error: toAppBackendError(error) }; } };
    return timer ? timer.measure(name, guarded) : guarded();
  };
  async function room(db: Db, id: string): Promise<AppResult<{ id: string; base_price: number | string }>> {
    const result = await db.from("rooms").select("id,base_price").eq("id", id).eq("owner_app_user_id", owner()).maybeSingle();
    if (result.error) return fail(result.error, "Could not read Room");
    return result.data ? ok(result.data) : appError({ message: "Room was not found.", code: "ROOM_NOT_FOUND", statusCode: 404 });
  }
  async function keyTenant(db: Db, id: string, roomId: string, requireActive: boolean): Promise<AppResult<TenantRecord>> {
    const result = await db.from("tenants").select("id,room_id,full_name,status").eq("id", id).eq("owner_app_user_id", owner()).maybeSingle();
    if (result.error) return fail(result.error, "Could not read Key Tenant");
    if (!result.data || result.data.room_id !== roomId) return appError({ message: "Key Tenant must belong to the same Room as the Contract.", code: "KEY_TENANT_ROOM_MISMATCH", statusCode: 422 });
    if (requireActive && result.data.status !== "Active") return appError({ message: "An active Contract requires an active Key Tenant.", code: "KEY_TENANT_NOT_ACTIVE", statusCode: 422 });
    return ok(result.data as TenantRecord);
  }
  const writeValues = (input: CreateContractInput | UpdateContractInput, roomId: string, status: "Active" | "Terminated") => ({
    room_id: roomId, key_tenant_id: input.keyTenantId, deposit_amount: input.depositAmount,
    rent_amount: input.rentAmount, electricity_price_override: input.electricityPriceOverride,
    water_price_override: input.waterPriceOverride, start_date: input.startDate, end_date: input.endDate,
    status, owner_app_user_id: owner(), updated_at: new Date().toISOString(),
  });
  async function present(db: Db, contract: ContractRecord, tenant: TenantRecord) {
    const roomResult = await room(db, contract.room_id);
    if (roomResult.error) return roomResult;
    return ok(buildContractList({ contracts: [contract], tenants: [tenant], roomBasePrice: Number(roomResult.data.base_price) })[0]);
  }
  return {
    deleteContract(contractId) { return run("repository.supabase.contract-delete", async () => {
      const db = await client();
      const deleted = await db.from("contracts").delete().eq("id", contractId)
        .eq("owner_app_user_id", owner()).select("id,room_id").maybeSingle();
      if (deleted.error) return fail(deleted.error, "Could not delete Contract");
      return deleted.data ? ok({ contractId: deleted.data.id, roomId: deleted.data.room_id })
        : appError({ message: "Contract was not found.", code: "CONTRACT_NOT_FOUND", statusCode: 404 });
    }); },
    listRoomContracts(roomId) { return run("repository.supabase.contracts-list", async () => {
      const db = await client();
      const targetRoom = await room(db, roomId);
      if (targetRoom.error) return targetRoom;
      const [contracts, tenants] = await Promise.all([
        db.from("contracts").select(contractColumns).eq("room_id", roomId).eq("owner_app_user_id", owner()).order("start_date"),
        db.from("tenants").select("id,full_name").eq("room_id", roomId).eq("owner_app_user_id", owner()),
      ]);
      if (contracts.error || tenants.error) return fail(contracts.error || tenants.error, "Could not read Contracts");
      return ok(buildContractList({ contracts: (contracts.data ?? []) as ContractRecord[],
        tenants: (tenants.data ?? []) as TenantRecord[], roomBasePrice: Number(targetRoom.data.base_price) }));
    }); },
    createContract(input) { return run("repository.supabase.contract-create", async () => {
      const db = await client();
      const targetRoom = await room(db, input.roomId);
      if (targetRoom.error) return targetRoom;
      const tenant = await keyTenant(db, input.keyTenantId, input.roomId, true);
      if (tenant.error) return tenant;
      const existing = await db.from("contracts").select("id").eq("room_id", input.roomId).eq("owner_app_user_id", owner()).eq("status", "Active").limit(1);
      if (existing.error) return fail(existing.error, "Could not check active Contract");
      if (existing.data?.length) return activeConflict();
      const saved = await db.from("contracts").insert(writeValues(input, input.roomId, "Active")).select(contractColumns).single();
      if (saved.error) return contractError(saved.error, "Could not create Contract");
      return present(db, saved.data as ContractRecord, tenant.data);
    }); },
    updateContract(input) { return run("repository.supabase.contract-update", async () => {
      const db = await client();
      const current = await db.from("contracts").select(contractColumns).eq("id", input.contractId).eq("owner_app_user_id", owner()).maybeSingle();
      if (current.error) return fail(current.error, "Could not read Contract");
      if (!current.data) return appError({ message: "Contract was not found.", code: "CONTRACT_NOT_FOUND", statusCode: 404 });
      const tenant = await keyTenant(db, input.keyTenantId, current.data.room_id, input.status === "Active");
      if (tenant.error) return tenant;
      if (input.status === "Active") {
        const active = await db.from("contracts").select("id").eq("room_id", current.data.room_id)
          .eq("owner_app_user_id", owner()).eq("status", "Active");
        if (active.error) return fail(active.error, "Could not check active Contract");
        if (active.data?.some((c) => c.id !== input.contractId)) return activeConflict();
      }
      const values = writeValues(input, current.data.room_id, input.status);
      const mutable = {
        key_tenant_id: values.key_tenant_id, deposit_amount: values.deposit_amount,
        rent_amount: values.rent_amount, electricity_price_override: values.electricity_price_override,
        water_price_override: values.water_price_override, start_date: values.start_date,
        end_date: values.end_date, status: values.status, updated_at: values.updated_at,
      };
      const saved = await db.from("contracts").update(mutable).eq("id", input.contractId)
        .eq("owner_app_user_id", owner()).select(contractColumns).maybeSingle();
      if (saved.error) return contractError(saved.error, "Could not update Contract");
      if (!saved.data) return appError({ message: "Contract was not found.", code: "CONTRACT_NOT_FOUND", statusCode: 404 });
      return present(db, saved.data as ContractRecord, tenant.data);
    }); },
  };
}

const activeConflict = () => appError({ message: "This Room already has an active Contract.", code: "ACTIVE_CONTRACT_ALREADY_EXISTS", statusCode: 409 });
function contractError(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "code" in error && error.code === "23505") return activeConflict();
  return fail(error, fallback);
}
