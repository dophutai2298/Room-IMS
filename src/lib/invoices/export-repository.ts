import type { AppResult } from "@/lib/insforge/errors";
import type {
  InvoiceRecord,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
} from "@/lib/insforge/types";
import type { BillingPeriod } from "@/lib/utilities/presenter";

export type InvoiceExportTarget = {
  roomId: string;
  billingPeriod: BillingPeriod;
};

export type InvoiceExportSource = {
  invoice: InvoiceRecord;
  room: Pick<RoomRecord, "id" | "name">;
  keyTenant: Pick<TenantRecord, "full_name"> | null;
  utilityMetric: UtilityMetricRecord | null;
};

export type InvoiceExportRepository = {
  findInvoiceExportSource(
    target: InvoiceExportTarget,
  ): Promise<AppResult<InvoiceExportSource>>;
};
