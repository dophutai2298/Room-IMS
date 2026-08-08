import "server-only";

import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import {
  buildInvoiceList,
  type InvoiceListItem,
} from "@/lib/invoices/presenter";
import {
  buildRoomDetailView,
  buildRoomListItem,
  type RoomDetailView,
  type RoomListItem,
} from "@/lib/rooms/presenter";
import {
  buildUtilityMetricsView,
  getUtilityMetricBaseline,
  type BillingPeriod,
  type UtilityMetricsView,
} from "@/lib/utilities/presenter";
import type {
  AppUser,
  ContractRecord,
  InvoiceDbStatus,
  InvoiceRecord,
  MvpSeededData,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
  UtilityPricingRecord,
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

export async function readInvoicesOverview(): Promise<AppResult<InvoiceListItem[]>> {
  try {
    await requireAppUserRole();
    const client = await createInsForgeServerClient();

    const [rooms, invoices] = await Promise.all([
      client.database.from("rooms").select("*").order("name"),
      client.database.from("invoices").select("*").order("year").order("month"),
    ]);

    for (const response of [rooms, invoices]) {
      if (response.error) {
        return fail(response.error);
      }
    }

    return ok(
      buildInvoiceList({
        rooms: (rooms.data ?? []) as RoomRecord[],
        invoices: (invoices.data ?? []) as InvoiceRecord[],
      }),
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

export async function readUtilityMetricsScreen({
  roomId,
  billingPeriod,
}: {
  roomId: string;
  billingPeriod: BillingPeriod;
}): Promise<AppResult<UtilityMetricsView>> {
  try {
    await requireAppUserRole();
    const client = await createInsForgeServerClient();

    const [rooms, tenants, activeContracts, metrics, invoices] = await Promise.all([
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
      client.database
        .from("utility_metrics")
        .select("*")
        .eq("room_id", roomId)
        .order("year")
        .order("month"),
      client.database
        .from("invoices")
        .select("*")
        .eq("room_id", roomId)
        .order("year")
        .order("month"),
    ]);

    for (const response of [rooms, tenants, activeContracts, metrics, invoices]) {
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
      buildUtilityMetricsView({
        room,
        tenants: (tenants.data ?? []) as TenantRecord[],
        activeContract: ((activeContracts.data ?? []) as ContractRecord[])[0] ?? null,
        metrics: (metrics.data ?? []) as UtilityMetricRecord[],
        invoices: (invoices.data ?? []) as InvoiceRecord[],
        billingPeriod,
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

export async function generateInvoiceFromUtilityMetrics({
  roomId,
  billingPeriod,
  otherFee,
  otherFeeNote,
}: {
  roomId: string;
  billingPeriod: BillingPeriod;
  otherFee: number;
  otherFeeNote?: string | null;
}): Promise<AppResult<InvoiceRecord>> {
  try {
    await requireAppUserRole();
    const client = await createInsForgeServerClient();

    const [rooms, activeContracts, metrics, utilityPricing, existingInvoices] =
      await Promise.all([
        client.database.from("rooms").select("*").eq("id", roomId).limit(1),
        client.database
          .from("contracts")
          .select("*")
          .eq("room_id", roomId)
          .eq("status", "Active")
          .order("start_date"),
        client.database
          .from("utility_metrics")
          .select("*")
          .eq("room_id", roomId)
          .eq("month", billingPeriod.month)
          .eq("year", billingPeriod.year)
          .limit(1),
        client.database
          .from("utility_pricing")
          .select("*")
          .order("effective_from"),
        client.database
          .from("invoices")
          .select("*")
          .eq("room_id", roomId)
          .eq("month", billingPeriod.month)
          .eq("year", billingPeriod.year)
          .limit(1),
      ]);

    for (const response of [
      rooms,
      activeContracts,
      metrics,
      utilityPricing,
      existingInvoices,
    ]) {
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

    const activeContract = resolveApplicableContract({
      contracts: (activeContracts.data ?? []) as ContractRecord[],
      billingPeriod,
    });

    if (!activeContract) {
      return appError({
        message: "This Room has no active Contract for this billing period.",
        code: "ACTIVE_CONTRACT_NOT_FOUND",
        statusCode: 409,
      });
    }

    const metric = ((metrics.data ?? []) as UtilityMetricRecord[])[0];

    if (!metric) {
      return appError({
        message: "Save Utility Metrics before generating an Invoice.",
        code: "UTILITY_METRICS_NOT_FOUND",
        statusCode: 409,
      });
    }

    const pricing = resolveApplicableUtilityPricing({
      utilityPricing: (utilityPricing.data ?? []) as UtilityPricingRecord[],
      billingPeriod,
    });

    const electricityUnitPrice =
      toNullableMoney(activeContract.electricity_price_override) ??
      pricing?.electricity_unit_price;
    const waterUnitPrice =
      toNullableMoney(activeContract.water_price_override) ??
      pricing?.water_unit_price;

    if (electricityUnitPrice === undefined || waterUnitPrice === undefined) {
      return appError({
        message: "No Utility Pricing applies to this billing period.",
        code: "UTILITY_PRICING_NOT_FOUND",
        statusCode: 409,
      });
    }

    const existingInvoice = ((existingInvoices.data ?? []) as InvoiceRecord[])[0] ?? null;
    const invoiceValues = buildInvoiceValues({
      room,
      activeContract,
      metric,
      billingPeriod,
      electricityUnitPrice: toMoney(electricityUnitPrice),
      waterUnitPrice: toMoney(waterUnitPrice),
      otherFee,
      otherFeeNote,
      existingInvoice,
    });

    const response = existingInvoice
      ? ((await client.database
          .from("invoices")
          .update(invoiceValues)
          .eq("id", existingInvoice.id)
          .select()
          .limit(1)) as QueryResponse<InvoiceRecord[]>)
      : ((await client.database
          .from("invoices")
          .insert(invoiceValues)
          .select()
          .limit(1)) as QueryResponse<InvoiceRecord[]>);

    if (response.error) {
      if (!existingInvoice) {
        const retryResult = await updateInvoiceAfterInsertRace({
          roomId,
          billingPeriod,
          values: invoiceValues,
        });

        if (retryResult.data) {
          return retryResult;
        }

        if (retryResult.error.code !== "INVOICE_INSERT_FAILED") {
          return retryResult;
        }
      }

      return fail(response.error, "Could not generate Invoice");
    }

    const invoice = response.data?.[0];

    if (!invoice) {
      return fail(new Error("Invoice generation returned no rows"), "Could not generate Invoice");
    }

    return ok(invoice);
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

export async function saveUtilityMetrics({
  roomId,
  billingPeriod,
  electricityNew,
  waterNew,
}: {
  roomId: string;
  billingPeriod: BillingPeriod;
  electricityNew: number;
  waterNew: number;
}): Promise<AppResult<UtilityMetricRecord>> {
  try {
    await requireAppUserRole();
    const client = await createInsForgeServerClient();

    const [rooms, metrics] = await Promise.all([
      client.database.from("rooms").select("id").eq("id", roomId).limit(1),
      client.database
        .from("utility_metrics")
        .select("*")
        .eq("room_id", roomId)
        .order("year")
        .order("month"),
    ]);

    for (const response of [rooms, metrics]) {
      if (response.error) {
        return fail(response.error);
      }
    }

    const room = ((rooms.data ?? []) as Pick<RoomRecord, "id">[])[0];

    if (!room) {
      return appError({
        message: "Room was not found.",
        code: "ROOM_NOT_FOUND",
        statusCode: 404,
      });
    }

    const baseline = getUtilityMetricBaseline({
      metrics: (metrics.data ?? []) as UtilityMetricRecord[],
      billingPeriod,
    });

    if (electricityNew < baseline.electricityOld) {
      return appError({
        message: "Chỉ số điện mới không được thấp hơn chỉ số điện cũ.",
        code: "ELECTRICITY_READING_ROLLBACK",
        statusCode: 422,
      });
    }

    if (waterNew < baseline.waterOld) {
      return appError({
        message: "Chỉ số nước mới không được thấp hơn chỉ số nước cũ.",
        code: "WATER_READING_ROLLBACK",
        statusCode: 422,
      });
    }

    const values = {
      room_id: roomId,
      month: billingPeriod.month,
      year: billingPeriod.year,
      electricity_old: baseline.electricityOld,
      electricity_new: electricityNew,
      water_old: baseline.waterOld,
      water_new: waterNew,
      updated_at: new Date().toISOString(),
    };

    const response = baseline.currentMetric
      ? ((await client.database
          .from("utility_metrics")
          .update(values)
          .eq("id", baseline.currentMetric.id)
          .select()
          .limit(1)) as QueryResponse<UtilityMetricRecord[]>)
      : ((await client.database
          .from("utility_metrics")
          .insert(values)
          .select()
          .limit(1)) as QueryResponse<UtilityMetricRecord[]>);

    if (response.error) {
      if (!baseline.currentMetric) {
        const retryResult = await updateUtilityMetricAfterInsertRace({
          roomId,
          billingPeriod,
          values,
        });

        if (retryResult.data) {
          return retryResult;
        }

        if (retryResult.error.code !== "UTILITY_METRICS_INSERT_FAILED") {
          return retryResult;
        }
      }

      return fail(response.error, "Could not save Utility Metrics");
    }

    const metric = response.data?.[0];

    if (!metric) {
      return fail(
        new Error("Utility Metrics save returned no rows"),
        "Could not save Utility Metrics",
      );
    }

    return ok(metric);
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function updateUtilityMetricAfterInsertRace({
  roomId,
  billingPeriod,
  values,
}: {
  roomId: string;
  billingPeriod: BillingPeriod;
  values: {
    room_id: string;
    month: number;
    year: number;
    electricity_old: number;
    electricity_new: number;
    water_old: number;
    water_new: number;
    updated_at: string;
  };
}): Promise<AppResult<UtilityMetricRecord>> {
  const client = await createInsForgeServerClient();
  const existingResponse = (await client.database
    .from("utility_metrics")
    .select("*")
    .eq("room_id", roomId)
    .eq("month", billingPeriod.month)
    .eq("year", billingPeriod.year)
    .limit(1)) as QueryResponse<UtilityMetricRecord[]>;

  if (existingResponse.error) {
    return fail(existingResponse.error, "Could not verify Utility Metrics conflict");
  }

  const existingMetric = existingResponse.data?.[0];

  if (!existingMetric) {
    return appError({
      message: "Utility Metrics insert failed and no existing period record was found.",
      code: "UTILITY_METRICS_INSERT_FAILED",
      statusCode: 409,
    });
  }

  const updateResponse = (await client.database
    .from("utility_metrics")
    .update(values)
    .eq("id", existingMetric.id)
    .select()
    .limit(1)) as QueryResponse<UtilityMetricRecord[]>;

  if (updateResponse.error) {
    return fail(updateResponse.error, "Could not update Utility Metrics after conflict");
  }

  const updatedMetric = updateResponse.data?.[0];

  if (!updatedMetric) {
    return fail(
      new Error("Utility Metrics conflict update returned no rows"),
      "Could not update Utility Metrics after conflict",
    );
  }

  return ok(updatedMetric);
}

async function updateInvoiceAfterInsertRace({
  roomId,
  billingPeriod,
  values,
}: {
  roomId: string;
  billingPeriod: BillingPeriod;
  values: InvoiceWriteValues;
}): Promise<AppResult<InvoiceRecord>> {
  const client = await createInsForgeServerClient();
  const existingResponse = (await client.database
    .from("invoices")
    .select("*")
    .eq("room_id", roomId)
    .eq("month", billingPeriod.month)
    .eq("year", billingPeriod.year)
    .limit(1)) as QueryResponse<InvoiceRecord[]>;

  if (existingResponse.error) {
    return fail(existingResponse.error, "Could not verify Invoice conflict");
  }

  const existingInvoice = existingResponse.data?.[0];

  if (!existingInvoice) {
    return appError({
      message: "Invoice insert failed and no existing period record was found.",
      code: "INVOICE_INSERT_FAILED",
      statusCode: 409,
    });
  }

  const updateValues = adjustInvoicePaymentState(values, existingInvoice);
  const updateResponse = (await client.database
    .from("invoices")
    .update(updateValues)
    .eq("id", existingInvoice.id)
    .select()
    .limit(1)) as QueryResponse<InvoiceRecord[]>;

  if (updateResponse.error) {
    return fail(updateResponse.error, "Could not update Invoice after conflict");
  }

  const updatedInvoice = updateResponse.data?.[0];

  if (!updatedInvoice) {
    return fail(
      new Error("Invoice conflict update returned no rows"),
      "Could not update Invoice after conflict",
    );
  }

  return ok(updatedInvoice);
}

function buildInvoiceValues({
  room,
  activeContract,
  metric,
  billingPeriod,
  electricityUnitPrice,
  waterUnitPrice,
  otherFee,
  otherFeeNote,
  existingInvoice,
}: {
  room: RoomRecord;
  activeContract: ContractRecord;
  metric: UtilityMetricRecord;
  billingPeriod: BillingPeriod;
  electricityUnitPrice: number;
  waterUnitPrice: number;
  otherFee: number;
  otherFeeNote?: string | null;
  existingInvoice: InvoiceRecord | null;
}): InvoiceWriteValues {
  const electricityConsumption =
    toMoney(metric.electricity_new) - toMoney(metric.electricity_old);
  const waterConsumption = toMoney(metric.water_new) - toMoney(metric.water_old);
  const roomFee = toMoney(activeContract.rent_amount ?? room.base_price);
  const electricityFee = roundMoney(electricityConsumption * electricityUnitPrice);
  const waterFee = roundMoney(waterConsumption * waterUnitPrice);
  const safeOtherFee = roundMoney(Math.max(otherFee, 0));
  const totalAmount = roundMoney(roomFee + electricityFee + waterFee + safeOtherFee);

  return adjustInvoicePaymentState(
    {
      room_id: room.id,
      month: billingPeriod.month,
      year: billingPeriod.year,
      room_fee: roomFee,
      electricity_fee: electricityFee,
      water_fee: waterFee,
      other_fee: safeOtherFee,
      other_fee_note:
        safeOtherFee > 0 ? normalizeOptionalText(otherFeeNote) : null,
      total_amount: totalAmount,
      amount_paid: 0,
      status: "Unpaid",
      updated_at: new Date().toISOString(),
    },
    existingInvoice,
  );
}

function adjustInvoicePaymentState(
  values: InvoiceWriteValues,
  existingInvoice: InvoiceRecord | null,
): InvoiceWriteValues {
  if (!existingInvoice) {
    return values;
  }

  const amountPaid = Math.min(toMoney(existingInvoice.amount_paid), values.total_amount);

  return {
    ...values,
    amount_paid: amountPaid,
    status: deriveInvoiceStatus({
      amountPaid,
      totalAmount: values.total_amount,
    }),
  };
}

function deriveInvoiceStatus({
  amountPaid,
  totalAmount,
}: {
  amountPaid: number;
  totalAmount: number;
}): InvoiceDbStatus {
  if (amountPaid <= 0) {
    return "Unpaid";
  }

  if (amountPaid >= totalAmount) {
    return "Paid";
  }

  return "Partially Paid";
}

function resolveApplicableUtilityPricing({
  utilityPricing,
  billingPeriod,
}: {
  utilityPricing: UtilityPricingRecord[];
  billingPeriod: BillingPeriod;
}) {
  const periodStart = new Date(Date.UTC(billingPeriod.year, billingPeriod.month - 1, 1));
  const sortedPricing = [...utilityPricing].sort(
    (left, right) =>
      new Date(left.effective_from).getTime() -
      new Date(right.effective_from).getTime(),
  );
  const latestHistoricalPricing = sortedPricing
    .filter((pricing) => new Date(pricing.effective_from) <= periodStart)
    .sort(
      (left, right) =>
        new Date(right.effective_from).getTime() -
        new Date(left.effective_from).getTime(),
    )[0];

  return latestHistoricalPricing ?? sortedPricing[0];
}

function resolveApplicableContract({
  contracts,
  billingPeriod,
}: {
  contracts: ContractRecord[];
  billingPeriod: BillingPeriod;
}) {
  const periodStart = new Date(Date.UTC(billingPeriod.year, billingPeriod.month - 1, 1));
  const periodEnd = new Date(Date.UTC(billingPeriod.year, billingPeriod.month, 0));

  return contracts
    .filter((contract) => {
      const startsOnOrBeforePeriodEnd = new Date(contract.start_date) <= periodEnd;
      const endsOnOrAfterPeriodStart =
        contract.end_date === null || new Date(contract.end_date) >= periodStart;

      return startsOnOrBeforePeriodEnd && endsOnOrAfterPeriodStart;
    })
    .sort(
      (left, right) =>
        new Date(right.start_date).getTime() - new Date(left.start_date).getTime(),
    )[0];
}

function toMoney(value: number | string | null) {
  return Number(value ?? 0);
}

function toNullableMoney(value: number | string | null) {
  if (value === null) {
    return null;
  }

  return Number(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeOptionalText(value: string | null | undefined) {
  const cleaned = value?.trim();

  return cleaned ? cleaned : null;
}

type InvoiceWriteValues = {
  room_id: string;
  month: number;
  year: number;
  room_fee: number;
  electricity_fee: number;
  water_fee: number;
  other_fee: number;
  other_fee_note: string | null;
  total_amount: number;
  amount_paid: number;
  status: InvoiceDbStatus;
  updated_at: string;
};

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
