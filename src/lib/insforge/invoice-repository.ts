import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { buildInvoiceList, type InvoiceListItem } from "@/lib/invoices/presenter";
import type { InvoiceListRepository } from "@/lib/invoices/repository";
import { fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import type { InvoiceRecord, RoomRecord } from "./types";

export function createInsForgeInvoiceRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): InvoiceListRepository {
  return {
    async listInvoiceItems() {
      const query = () => readInvoiceItemsFromInsForge();

      return timer
        ? timer.measure("repository.insforge.invoices-list", query)
        : query();
    },
  };
}

async function readInvoiceItemsFromInsForge(): Promise<AppResult<InvoiceListItem[]>> {
  try {
    const client = await createInsForgeServerClient();
    const [rooms, invoices] = await Promise.all([
      client.database.from("rooms").select("id, name").order("name"),
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
        .order("year")
        .order("month"),
    ]);

    for (const response of [rooms, invoices]) {
      if (response.error) {
        return fail(response.error);
      }
    }

    return ok(
      buildInvoiceList({
        rooms: (rooms.data ?? []) as RoomRecord[],
        invoices: (invoices.data ?? []) as unknown as InvoiceRecord[],
      }),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}
