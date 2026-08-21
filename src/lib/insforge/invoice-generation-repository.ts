import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { resolveApplicableContract } from "@/lib/contracts/billing-period";
import {
  buildInvoiceGenerationConditionalUpdate,
  buildInvoiceGenerationValues,
  type GenerateInvoiceInput,
  type InvoiceGenerationValues,
} from "@/lib/invoices/generation";
import type { InvoiceGenerationRepository } from "@/lib/invoices/generation-repository";
import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import type {
  ContractRecord,
  InvoiceRecord,
  RoomRecord,
  UtilityMetricRecord,
  UtilityPricingRecord,
} from "./types";

type QueryResponse<T> = {
  data: T | null;
  error: unknown;
};

type InsForgeServerClient = Awaited<
  ReturnType<typeof createInsForgeServerClient>
>;

export function createInsForgeInvoiceGenerationRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): InvoiceGenerationRepository {
  let clientPromise: Promise<InsForgeServerClient> | null = null;
  const getClient = () => {
    clientPromise ??= createInsForgeServerClient({ timer });
    return clientPromise;
  };

  return {
    async generateInvoice(input) {
      const query = () => generateInvoiceInInsForge({ getClient, input });

      return timer
        ? timer.measure("repository.insforge.invoice-generation", query)
        : query();
    },
  };
}

async function generateInvoiceInInsForge({
  getClient,
  input,
}: {
  getClient: () => Promise<InsForgeServerClient>;
  input: GenerateInvoiceInput;
}): Promise<AppResult<InvoiceRecord>> {
  try {
    const client = await getClient();
    const periodStart = toPeriodStart(input.billingPeriod);
    const periodEnd = toPeriodEnd(input.billingPeriod);
    const [rooms, activeContracts, metrics, utilityPricing, existingInvoices] =
      await Promise.all([
        client.database
          .from("rooms")
          .select("id, base_price")
          .eq("id", input.roomId)
          // .limit(1)
          ,
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
          .eq("room_id", input.roomId)
          .lte("start_date", toIsoDate(periodEnd))
          .order("start_date"),
        client.database
          .from("utility_metrics")
          .select(utilityMetricSelect)
          .eq("room_id", input.roomId)
          .eq("month", input.billingPeriod.month)
          .eq("year", input.billingPeriod.year)
          // .limit(1)
          ,
        client.database
          .from("utility_pricing")
          .select(
            "id, effective_from, electricity_unit_price, water_unit_price, is_active",
          )
          .order("effective_from"),
        client.database
          .from("invoices")
          .select(invoiceSelect)
          .eq("room_id", input.roomId)
          .eq("month", input.billingPeriod.month)
          .eq("year", input.billingPeriod.year)
          // .limit(1)
          ,
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

    const room = ((rooms.data ?? []) as unknown as Array<
      Pick<RoomRecord, "id" | "base_price">
    >)[0];

    if (!room) {
      return appError({
        message: "Room was not found.",
        code: "ROOM_NOT_FOUND",
        statusCode: 404,
      });
    }

    const activeContract = resolveApplicableContract({
      contracts: (activeContracts.data ?? []) as unknown as ContractRecord[],
      billingPeriod: input.billingPeriod,
    });

    if (!activeContract) {
      return appError({
        message: "This Room has no active Contract for this billing period.",
        code: "ACTIVE_CONTRACT_NOT_FOUND",
        statusCode: 409,
      });
    }

    const metric = ((metrics.data ?? []) as unknown as UtilityMetricRecord[])[0];

    if (!metric) {
      return appError({
        message: "Save Utility Metrics before generating an Invoice.",
        code: "UTILITY_METRICS_NOT_FOUND",
        statusCode: 409,
      });
    }

    const pricing = resolveApplicableUtilityPricing({
      utilityPricing: (utilityPricing.data ?? []) as unknown as UtilityPricingRecord[],
      periodStart,
    });
    const electricityUnitPrice =
      activeContract.electricity_price_override ??
      pricing?.electricity_unit_price;
    const waterUnitPrice =
      activeContract.water_price_override ?? pricing?.water_unit_price;

    if (electricityUnitPrice === undefined || waterUnitPrice === undefined) {
      return appError({
        message: "No Utility Pricing applies to this billing period.",
        code: "UTILITY_PRICING_NOT_FOUND",
        statusCode: 409,
      });
    }

    const existingInvoice =
      ((existingInvoices.data ?? []) as unknown as InvoiceRecord[])[0] ?? null;
    const values = buildInvoiceGenerationValues({
      room,
      activeContract,
      metric,
      billingPeriod: input.billingPeriod,
      electricityUnitPrice: Number(electricityUnitPrice),
      waterUnitPrice: Number(waterUnitPrice),
      otherFee: input.otherFee,
      otherFeeNote: input.otherFeeNote,
      existingInvoice: null,
    });

    if (existingInvoice) {
      return updateInvoicePreservingConcurrentPayment({
        client,
        existingInvoice,
        values,
      });
    }

    const response = (await client.database
      .from("invoices")
      .insert(values)
      .select(invoiceSelect)
      // .limit(1)
    ) as QueryResponse<InvoiceRecord[]>;

    if (response.error) {
      const retryResult = await updateInvoiceAfterInsertRace({
        client,
        input,
        values,
      });

      if (retryResult.data) {
        return retryResult;
      }

      if (retryResult.error.code !== "INVOICE_INSERT_FAILED") {
        return retryResult;
      }

      return fail(response.error, "Could not generate Invoice");
    }

    const invoice = response.data?.[0];

    if (!invoice) {
      return fail(
        new Error("Invoice generation returned no rows"),
        "Could not generate Invoice",
      );
    }

    return ok(invoice);
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function updateInvoiceAfterInsertRace({
  client,
  input,
  values,
}: {
  client: InsForgeServerClient;
  input: GenerateInvoiceInput;
  values: InvoiceGenerationValues;
}): Promise<AppResult<InvoiceRecord>> {
  const existingResponse = (await client.database
    .from("invoices")
    .select(invoiceSelect)
    .eq("room_id", input.roomId)
    .eq("month", input.billingPeriod.month)
    .eq("year", input.billingPeriod.year)
    // .limit(1)
  ) as QueryResponse<InvoiceRecord[]>;

  if (existingResponse.error) {
    return fail(existingResponse.error, "Could not verify Invoice conflict");
  }

  const existingInvoice = existingResponse.data?.[0];

  if (!existingInvoice) {
    return appError({
      message:
        "Invoice insert failed and no existing period record was found.",
      code: "INVOICE_INSERT_FAILED",
      statusCode: 409,
    });
  }

  return updateInvoicePreservingConcurrentPayment({
    client,
    existingInvoice,
    values,
  });
}

async function updateInvoicePreservingConcurrentPayment({
  client,
  existingInvoice,
  values,
}: {
  client: InsForgeServerClient;
  existingInvoice: InvoiceRecord;
  values: InvoiceGenerationValues;
}): Promise<AppResult<InvoiceRecord>> {
  let observedInvoice = existingInvoice;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const conditionalUpdate = buildInvoiceGenerationConditionalUpdate(
      values,
      observedInvoice,
    );
    const updateResponse = (await client.database
      .from("invoices")
      .update(conditionalUpdate.values)
      .eq("id", observedInvoice.id)
      .eq("amount_paid", conditionalUpdate.expectedPayment.amountPaid)
      .eq("status", conditionalUpdate.expectedPayment.status)
      .select(invoiceSelect)
      // .limit(1)
    ) as QueryResponse<InvoiceRecord[]>;

    if (updateResponse.error) {
      return fail(updateResponse.error, "Could not update Invoice safely");
    }

    const updatedInvoice = updateResponse.data?.[0];

    if (updatedInvoice) {
      return ok(updatedInvoice);
    }

    const latestResponse = (await client.database
      .from("invoices")
      .select(invoiceSelect)
      .eq("id", observedInvoice.id)
      // .limit(1)
    ) as QueryResponse<InvoiceRecord[]>;

    if (latestResponse.error) {
      return fail(
        latestResponse.error,
        "Could not refresh Invoice payment state",
      );
    }

    const latestInvoice = latestResponse.data?.[0];

    if (!latestInvoice) {
      return appError({
        message: "Invoice was removed while it was being regenerated.",
        code: "INVOICE_NOT_FOUND",
        statusCode: 404,
      });
    }

    observedInvoice = latestInvoice;
  }

  return appError({
    message: "Invoice payment changed while the Invoice was being regenerated.",
    code: "INVOICE_CONCURRENT_UPDATE",
    statusCode: 409,
  });
}

function resolveApplicableUtilityPricing({
  utilityPricing,
  periodStart,
}: {
  utilityPricing: UtilityPricingRecord[];
  periodStart: Date;
}) {
  const sortedPricing = [...utilityPricing].sort(
    (left, right) =>
      new Date(left.effective_from).getTime() -
      new Date(right.effective_from).getTime(),
  );
  const latestHistoricalPricing = sortedPricing
    .filter((pricing) => new Date(pricing.effective_from) <= periodStart)
    .at(-1);

  return latestHistoricalPricing ?? sortedPricing[0];
}

function toPeriodStart({ month, year }: GenerateInvoiceInput["billingPeriod"]) {
  return new Date(Date.UTC(year, month - 1, 1));
}

function toPeriodEnd({ month, year }: GenerateInvoiceInput["billingPeriod"]) {
  return new Date(Date.UTC(year, month, 0));
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
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
