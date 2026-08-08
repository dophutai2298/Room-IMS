import "server-only";

import type { AppResult } from "@/lib/insforge/errors";
import type { InvoiceRecord } from "@/lib/insforge/types";
import type { InvoiceListItem } from "./presenter";
import { recordInvoicePaymentForOperations } from "./service";
import type {
  InvoiceRepository,
  InvoicePaymentTarget,
} from "./repository";

const smokeInvoice = {
  id: "00000000-0000-0000-0000-000000000501",
  totalAmount: 3_020_000,
};

export async function runInvoicePaymentServiceBehaviorSmoke(): Promise<{
  paidSetsAmountToTotal: AppResult<InvoiceListItem>;
  unpaidSetsAmountToZero: AppResult<InvoiceListItem>;
  partialPersistsEnteredAmount: AppResult<InvoiceListItem>;
  rejectsNegativePartialAmount: AppResult<InvoiceListItem>;
  rejectsOverpaidPartialAmount: AppResult<InvoiceListItem>;
}> {
  return {
    paidSetsAmountToTotal: await recordInvoicePaymentForOperations({
      repository: createSmokeRepository(),
      invoiceId: smokeInvoice.id,
      status: "Paid",
      amountPaid: 1,
    }),
    unpaidSetsAmountToZero: await recordInvoicePaymentForOperations({
      repository: createSmokeRepository(),
      invoiceId: smokeInvoice.id,
      status: "Unpaid",
      amountPaid: 100_000,
    }),
    partialPersistsEnteredAmount: await recordInvoicePaymentForOperations({
      repository: createSmokeRepository(),
      invoiceId: smokeInvoice.id,
      status: "Partially Paid",
      amountPaid: 500_000,
    }),
    rejectsNegativePartialAmount: await recordInvoicePaymentForOperations({
      repository: createSmokeRepository(),
      invoiceId: smokeInvoice.id,
      status: "Partially Paid",
      amountPaid: -1,
    }),
    rejectsOverpaidPartialAmount: await recordInvoicePaymentForOperations({
      repository: createSmokeRepository(),
      invoiceId: smokeInvoice.id,
      status: "Partially Paid",
      amountPaid: smokeInvoice.totalAmount + 1,
    }),
  };
}

function createSmokeRepository(): InvoiceRepository {
  return {
    async listInvoiceItems(): Promise<AppResult<InvoiceListItem[]>> {
      return fail({
        code: "SMOKE_LIST_NOT_USED",
        message: "List is outside this behavior smoke.",
        statusCode: 500,
      });
    },
    async findInvoicePaymentTarget(): Promise<AppResult<InvoicePaymentTarget>> {
      return ok(smokeInvoice);
    },
    async updateInvoicePayment({
      invoiceId,
      status,
      amountPaid,
    }): Promise<AppResult<InvoiceListItem>> {
      return ok(createInvoiceListItem({ invoiceId, status, amountPaid }));
    },
  };
}

function createInvoiceListItem({
  invoiceId,
  status,
  amountPaid,
}: {
  invoiceId: string;
  status: InvoiceRecord["status"];
  amountPaid: number;
}): InvoiceListItem {
  return {
    id: invoiceId,
    shortId: "INV-2607-00000000",
    roomId: "00000000-0000-0000-0000-000000000101",
    roomName: "P101",
    billingPeriod: {
      month: 7,
      year: 2026,
    },
    periodLabel: "07/2026",
    roomFee: 2_500_000,
    electricityFee: 350_000,
    waterFee: 170_000,
    otherFee: 0,
    otherFeeNote: null,
    utilityFee: 520_000,
    totalAmount: smokeInvoice.totalAmount,
    amountPaid,
    balanceDue: Math.max(smokeInvoice.totalAmount - amountPaid, 0),
    status,
  };
}

function ok<T>(data: T): AppResult<T> {
  return {
    data,
    error: null,
  };
}

function fail<T = never>(error: {
  code: string;
  message: string;
  statusCode: number;
}): AppResult<T> {
  return {
    data: null,
    error,
  };
}
