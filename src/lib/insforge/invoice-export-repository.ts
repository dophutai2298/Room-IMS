import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { resolveApplicableContract } from "@/lib/contracts/billing-period";
import type {
  InvoiceExportRepository,
  InvoiceExportSource,
} from "@/lib/invoices/export-repository";
import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import type {
  ContractRecord,
  InvoiceRecord,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
} from "./types";

type InsForgeServerClient = Awaited<ReturnType<typeof createInsForgeServerClient>>;
type ContractTenantTarget = Pick<
  ContractRecord,
  "end_date" | "key_tenant_id" | "start_date"
> & {
  tenants:
    | Pick<TenantRecord, "full_name">
    | Pick<TenantRecord, "full_name">[]
    | null;
};

export function createInsForgeInvoiceExportRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): InvoiceExportRepository {
  let clientPromise: Promise<InsForgeServerClient> | null = null;
  const getClient = () => {
    clientPromise ??= createInsForgeServerClient();
    return clientPromise;
  };

  return {
    findInvoiceExportSource(target) {
      const query = () =>
        readInvoiceExportSourceFromInsForge({ ...target, getClient });

      return timer
        ? timer.measure("repository.insforge.invoice-pdf-read", query)
        : query();
    },
  };
}

async function readInvoiceExportSourceFromInsForge({
  roomId,
  billingPeriod,
  getClient,
}: Parameters<InvoiceExportRepository["findInvoiceExportSource"]>[0] & {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<InvoiceExportSource>> {
  try {
    const client = await getClient();
    const [roomResponse, invoiceResponse, metricResponse, contractsResponse] =
      await Promise.all([
        client.database
          .from("rooms")
          .select("id, name")
          .eq("id", roomId)
          .limit(1),
        client.database
          .from("invoices")
          .select(invoiceExportSelect)
          .eq("room_id", roomId)
          .eq("month", billingPeriod.month)
          .eq("year", billingPeriod.year)
          .limit(1),
        client.database
          .from("utility_metrics")
          .select(utilityMetricSelect)
          .eq("room_id", roomId)
          .eq("month", billingPeriod.month)
          .eq("year", billingPeriod.year)
          .limit(1),
        client.database
          .from("contracts")
          .select("key_tenant_id, start_date, end_date, tenants(full_name)")
          .eq("room_id", roomId)
          .order("start_date"),
      ]);

    const responses = [
      roomResponse,
      invoiceResponse,
      metricResponse,
      contractsResponse,
    ];

    for (const response of responses) {
      if (response.error) {
        return fail(response.error, "Could not read Invoice PDF data");
      }
    }

    const room = ((roomResponse.data ?? []) as unknown as Pick<
      RoomRecord,
      "id" | "name"
    >[])[0];

    if (!room) {
      return appError({
        code: "ROOM_NOT_FOUND",
        message: "Room was not found.",
        statusCode: 404,
      });
    }

    const invoice = ((invoiceResponse.data ?? []) as unknown as InvoiceRecord[])[0];

    if (!invoice) {
      return appError({
        code: "INVOICE_NOT_FOUND",
        message: "Invoice was not found for the selected room and billing period.",
        statusCode: 404,
      });
    }

    const contract = resolveApplicableContract({
      contracts: (contractsResponse.data ?? []) as unknown as ContractTenantTarget[],
      billingPeriod,
    });
    const keyTenant = readRelatedTenant(contract?.tenants);

    return ok({
      invoice,
      room,
      keyTenant,
      utilityMetric:
        ((metricResponse.data ?? []) as unknown as UtilityMetricRecord[])[0] ??
        null,
    });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

function readRelatedTenant(
  relation: ContractTenantTarget["tenants"] | undefined,
) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
}

const invoiceExportSelect = [
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
