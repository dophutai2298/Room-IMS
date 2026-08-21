import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import {
  buildInvoiceList,
  buildInvoiceListFromJoinedRows,
  type InvoiceListItem,
  type InvoiceListJoinedRow,
} from "@/lib/invoices/presenter";
import type {
  InvoiceRepository,
  InvoicePaymentTarget,
  PersistInvoicePaymentInput,
} from "@/lib/invoices/repository";
import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import type { InvoiceRecord, RoomRecord } from "./types";

type QueryResponse<T> = {
  data: T | null;
  error: unknown;
};

type InsForgeServerClient = Awaited<ReturnType<typeof createInsForgeServerClient>>;

export function createInsForgeInvoiceRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): InvoiceRepository {
  let clientPromise: Promise<InsForgeServerClient> | null = null;
  const getClient = () => {
    clientPromise ??= createInsForgeServerClient({ timer });
    return clientPromise;
  };

  return {
    async listInvoiceItems() {
      const query = () => readInvoiceItemsFromInsForge({ getClient });

      return timer
        ? timer.measure("repository.insforge.invoices-list", query)
        : query();
    },
    async findInvoicePaymentTarget(invoiceId) {
      const query = () => readInvoicePaymentTargetFromInsForge({ invoiceId, getClient });

      return timer
        ? timer.measure("repository.insforge.invoice-payment-read", query)
        : query();
    },
    async updateInvoicePayment(input) {
      const query = () => updateInvoicePaymentInInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.invoice-payment-write", query)
        : query();
    },
  };
}

async function readInvoiceItemsFromInsForge({
  getClient,
}: {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<InvoiceListItem[]>> {
  try {
    const client = await getClient();
    const response = await client.database
      .from("invoices")
      .select(
        `${invoiceListSelect}, room:rooms!invoices_room_id_fkey(name)`,
      )
      .order("year")
      .order("month");

    if (response.error) {
      return fail(response.error);
    }

    return ok(
      buildInvoiceListFromJoinedRows(
        (response.data ?? []) as unknown as InvoiceListJoinedRow[],
      ),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readInvoicePaymentTargetFromInsForge({
  invoiceId,
  getClient,
}: {
  invoiceId: string;
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<InvoicePaymentTarget>> {
  try {
    const client = await getClient();
    const response = (await client.database
      .from("invoices")
      .select("id, total_amount")
      .eq("id", invoiceId)
      .limit(1)) as QueryResponse<Array<Pick<InvoiceRecord, "id" | "total_amount">>>;

    if (response.error) {
      return fail(response.error, "Could not read Invoice payment target");
    }

    const invoice = response.data?.[0];

    if (!invoice) {
      return appError({
        message: "Invoice was not found.",
        code: "INVOICE_NOT_FOUND",
        statusCode: 404,
      });
    }

    return ok({
      id: invoice.id,
      totalAmount: toMoney(invoice.total_amount),
    });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function updateInvoicePaymentInInsForge({
  invoiceId,
  status,
  amountPaid,
  getClient,
}: PersistInvoicePaymentInput & {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<InvoiceListItem>> {
  try {
    const client = await getClient();
    const updateResponse = (await client.database
      .from("invoices")
      .update({
        amount_paid: amountPaid,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
      .select(invoiceListSelect)) as QueryResponse<InvoiceRecord[]>;

    if (updateResponse.error) {
      return fail(updateResponse.error, "Could not update Invoice payment");
    }

    const updatedInvoice = updateResponse.data?.[0];

    if (!updatedInvoice) {
      return appError({
        message: "Invoice was not found.",
        code: "INVOICE_NOT_FOUND",
        statusCode: 404,
      });
    }

    const roomResponse = (await client.database
      .from("rooms")
      .select("id, name")
      .eq("id", updatedInvoice.room_id)
      .limit(1)) as QueryResponse<RoomRecord[]>;

    if (roomResponse.error) {
      return fail(roomResponse.error, "Could not read Invoice room");
    }

    const item = buildInvoiceList({
      invoices: [updatedInvoice],
      rooms: (roomResponse.data ?? []) as RoomRecord[],
    })[0];

    if (!item) {
      return fail(
        new Error("Invoice payment update returned no item"),
        "Could not update Invoice payment",
      );
    }

    return ok(item);
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

const invoiceListSelect = [
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

function toMoney(value: number | string | null) {
  return Number(value ?? 0);
}
