import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import type { UtilityMetricsRepository } from "@/lib/utilities/repository";
import {
  buildUtilityMetricsView,
  getUtilityMetricBaseline,
} from "@/lib/utilities/presenter";
import { getUtilityMetricReadPlan } from "@/lib/utilities/query-plan";
import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import type {
  ContractRecord,
  InvoiceRecord,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
} from "./types";

type QueryResponse<T> = {
  data: T | null;
  error: unknown;
};

type InsForgeServerClient = Awaited<
  ReturnType<typeof createInsForgeServerClient>
>;

export function createInsForgeUtilityMetricsRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): UtilityMetricsRepository {
  let clientPromise: Promise<InsForgeServerClient> | null = null;
  const getClient = () => {
    clientPromise ??= createInsForgeServerClient({ timer });
    return clientPromise;
  };

  return {
    readUtilityMetricsScreen(input) {
      const query = () =>
        readUtilityMetricsScreenFromInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.utility-metrics-read", query)
        : query();
    },
    saveUtilityMetrics(input) {
      const query = () => saveUtilityMetricsToInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.utility-metrics-write", query)
        : query();
    },
  };
}

async function readUtilityMetricsScreenFromInsForge({
  roomId,
  billingPeriod,
  getClient,
}: Parameters<UtilityMetricsRepository["readUtilityMetricsScreen"]>[0] & {
  getClient: () => Promise<InsForgeServerClient>;
}) {
  try {
    const client = await getClient();
    const [rooms, tenants, activeContracts, metrics, invoices] = await Promise.all([
      client.database
        .from("rooms")
        .select("id, name")
        .eq("id", roomId)
        .limit(1),
      client.database
        .from("tenants")
        .select("id, full_name")
        .eq("room_id", roomId)
        .order("full_name"),
      client.database
        .from("contracts")
        .select(
          [
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
          ].join(", "),
        )
        .eq("room_id", roomId)
        .eq("status", "Active")
        .order("start_date"),
      readRelevantUtilityMetrics({ client, roomId, billingPeriod }),
      client.database
        .from("invoices")
        .select(invoiceSelect)
        .eq("room_id", roomId)
        .eq("month", billingPeriod.month)
        .eq("year", billingPeriod.year)
        .limit(1),
    ]);

    for (const response of [rooms, tenants, activeContracts, metrics, invoices]) {
      if (response.error) {
        return fail(response.error);
      }
    }

    const room = ((rooms.data ?? []) as unknown as RoomRecord[])[0];

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
        tenants: (tenants.data ?? []) as unknown as TenantRecord[],
        activeContract:
          ((activeContracts.data ?? []) as unknown as ContractRecord[])[0] ??
          null,
        metrics: (metrics.data ?? []) as unknown as UtilityMetricRecord[],
        invoices: (invoices.data ?? []) as unknown as InvoiceRecord[],
        billingPeriod,
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function saveUtilityMetricsToInsForge({
  roomId,
  allowUpdateExisting = true,
  billingPeriod,
  electricityNew,
  waterNew,
  getClient,
}: Parameters<UtilityMetricsRepository["saveUtilityMetrics"]>[0] & {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<UtilityMetricRecord>> {
  try {
    const client = await getClient();

    const [rooms, metrics] = await Promise.all([
      client.database.from("rooms").select("id").eq("id", roomId).limit(1),
      readRelevantUtilityMetrics({ client, roomId, billingPeriod }),
    ]);

    for (const response of [rooms, metrics]) {
      if (response.error) {
        return fail(response.error);
      }
    }

    const room = ((rooms.data ?? []) as unknown as Pick<RoomRecord, "id">[])[0];

    if (!room) {
      return appError({
        message: "Room was not found.",
        code: "ROOM_NOT_FOUND",
        statusCode: 404,
      });
    }

    const baseline = getUtilityMetricBaseline({
      metrics: (metrics.data ?? []) as unknown as UtilityMetricRecord[],
      billingPeriod,
    });

    if (baseline.currentMetric && !allowUpdateExisting) {
      return existingUtilityMetricsMutationForbidden();
    }

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
        .select(utilityMetricSelect)) as QueryResponse<UtilityMetricRecord[]>)
    : ((await client.database
        .from("utility_metrics")
        .insert(values)
        .select(utilityMetricSelect)) as QueryResponse<UtilityMetricRecord[]>);

    if (response.error) {
      if (!baseline.currentMetric) {
        if (
          !allowUpdateExisting &&
          isUniqueConstraintError(response.error)
        ) {
          return existingUtilityMetricsMutationForbidden();
        }

        if (allowUpdateExisting) {
          const retryResult = await updateUtilityMetricAfterInsertRace({
            client,
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

function isUniqueConstraintError(error: unknown) {
  const metadata =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const code = String(metadata.code ?? "");
  const message = String(metadata.message ?? metadata.details ?? "");

  return (
    code === "23505" ||
    message.toLowerCase().includes("duplicate key") ||
    message.toLowerCase().includes("unique constraint")
  );
}

function existingUtilityMetricsMutationForbidden() {
  return appError({
    message: "Only Admin/Landlord can update existing Utility Metrics.",
    code: "STAFF_UPDATE_FORBIDDEN",
    statusCode: 403,
  });
}

async function updateUtilityMetricAfterInsertRace({
  client,
  roomId,
  billingPeriod,
  values,
}: {
  client: InsForgeServerClient;
  roomId: string;
  billingPeriod: { month: number; year: number };
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
  const existingResponse = (await client.database
    .from("utility_metrics")
    .select(utilityMetricSelect)
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
    .select(utilityMetricSelect)
    .limit(1)) as QueryResponse<UtilityMetricRecord[]>;

  if (updateResponse.error) {
    return fail(
      updateResponse.error,
      "Could not update Utility Metrics after conflict",
    );
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

async function readRelevantUtilityMetrics({
  client,
  roomId,
  billingPeriod,
}: {
  client: InsForgeServerClient;
  roomId: string;
  billingPeriod: { month: number; year: number };
}) {
  const plan = getUtilityMetricReadPlan(billingPeriod);
  const [current, earlierThisYear] = (await Promise.all([
    client.database
      .from("utility_metrics")
      .select(utilityMetricSelect)
      .eq("room_id", roomId)
      .eq("year", plan.current.year)
      .eq("month", plan.current.month)
      .limit(1),
    client.database
      .from("utility_metrics")
      .select(utilityMetricSelect)
      .eq("room_id", roomId)
      .eq("year", plan.earlierThisYear.year)
      .lt("month", plan.earlierThisYear.beforeMonth)
      .order("month", { ascending: false })
      .limit(1),
  ])) as QueryResponse<UtilityMetricRecord[]>[];
  const failedResponse = [current, earlierThisYear].find(
    (response) => response.error,
  );

  if (failedResponse) {
    return { data: null, error: failedResponse.error };
  }

  const currentMetric = current.data?.[0];
  const previousThisYear = earlierThisYear.data?.[0];

  if (previousThisYear) {
    return {
      data: [currentMetric, previousThisYear].filter(
        (metric): metric is UtilityMetricRecord => Boolean(metric),
      ),
      error: null,
    };
  }

  const latestPriorYear = (await client.database
    .from("utility_metrics")
    .select(utilityMetricSelect)
    .eq("room_id", roomId)
    .lt("year", plan.priorYears.beforeYear)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1)) as QueryResponse<UtilityMetricRecord[]>;

  if (latestPriorYear.error) {
    return { data: null, error: latestPriorYear.error };
  }

  return {
    data: [currentMetric, latestPriorYear.data?.[0]].filter(
      (metric): metric is UtilityMetricRecord => Boolean(metric),
    ),
    error: null,
  };
}

const utilityMetricSelect = [
  "id",
  "room_id",
  "month",
  "year",
  "electricity_old",
  "electricity_new",
  "water_old",
  "water_new",
].join(", ");

const invoiceSelect = [
  "id",
  "room_id",
  "month",
  "year",
  "room_fee",
  "electricity_fee",
  "water_fee",
  "other_fee",
  "other_fee_note",
  "total_amount",
  "amount_paid",
  "status",
].join(", ");
