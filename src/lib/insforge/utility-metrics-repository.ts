import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import type { UtilityMetricsRepository } from "@/lib/utilities/repository";
import {
  buildUtilityMetricsView,
  getUtilityMetricBaseline,
} from "@/lib/utilities/presenter";
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

export function createInsForgeUtilityMetricsRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): UtilityMetricsRepository {
  return {
    readUtilityMetricsScreen(input) {
      const query = () => readUtilityMetricsScreenFromInsForge(input);

      return timer
        ? timer.measure("repository.insforge.utility-metrics-read", query)
        : query();
    },
    saveUtilityMetrics(input) {
      const query = () => saveUtilityMetricsToInsForge(input);

      return timer
        ? timer.measure("repository.insforge.utility-metrics-write", query)
        : query();
    },
  };
}

async function readUtilityMetricsScreenFromInsForge({
  roomId,
  billingPeriod,
}: Parameters<UtilityMetricsRepository["readUtilityMetricsScreen"]>[0]) {
  try {
    const client = await createInsForgeServerClient();
    const [rooms, tenants, activeContracts, metrics, invoices] = await Promise.all([
      client.database
        .from("rooms")
        .select("id, name")
        .eq("id", roomId)
        .limit(1),
      client.database
        .from("tenants")
        .select("id, room_id, full_name, phone, is_key_tenant, status")
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
      client.database
        .from("utility_metrics")
        .select(
          [
            "id",
            "room_id",
            "month",
            "year",
            "electricity_old",
            "electricity_new",
            "water_old",
            "water_new",
          ].join(", "),
        )
        .eq("room_id", roomId)
        .order("year")
        .order("month"),
      client.database
        .from("invoices")
        .select(
          [
            "id",
            "room_id",
            "month",
            "year",
            "room_fee",
            "electricity_fee",
            "water_fee",
            "other_fee",
            "total_amount",
            "amount_paid",
            "status",
          ].join(", "),
        )
        .eq("room_id", roomId)
        .order("year")
        .order("month"),
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
  billingPeriod,
  electricityNew,
  waterNew,
}: Parameters<UtilityMetricsRepository["saveUtilityMetrics"]>[0]): Promise<
  AppResult<UtilityMetricRecord>
> {
  try {
    const client = await createInsForgeServerClient();

    const [rooms, metrics] = await Promise.all([
      client.database.from("rooms").select("id").eq("id", roomId).limit(1),
      client.database
        .from("utility_metrics")
        .select(
          [
            "id",
            "room_id",
            "month",
            "year",
            "electricity_old",
            "electricity_new",
            "water_old",
            "water_new",
          ].join(", "),
        )
        .eq("room_id", roomId)
        .order("year")
        .order("month"),
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
