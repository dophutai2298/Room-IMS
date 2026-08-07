import "server-only";

import { appError, type AppResult } from "@/lib/insforge/errors";
import type { InvoiceListItem } from "./presenter";
import type {
  InvoiceRepository,
  RecordInvoicePaymentInput,
} from "./repository";

export async function listInvoicesForOperations({
  repository,
}: {
  repository: InvoiceRepository;
}): Promise<AppResult<InvoiceListItem[]>> {
  return repository.listInvoiceItems();
}

export async function recordInvoicePaymentForOperations({
  repository,
  invoiceId,
  status,
  amountPaid,
}: {
  repository: InvoiceRepository;
} & RecordInvoicePaymentInput): Promise<AppResult<InvoiceListItem>> {
  const target = await repository.findInvoicePaymentTarget(invoiceId);

  if (target.error) {
    return target;
  }

  const normalized = normalizeInvoicePayment({
    status,
    amountPaid,
    totalAmount: target.data.totalAmount,
  });

  if (normalized.error) {
    return normalized;
  }

  return repository.updateInvoicePayment({
    invoiceId,
    status,
    amountPaid: normalized.data.amountPaid,
  });
}

function normalizeInvoicePayment({
  status,
  amountPaid,
  totalAmount,
}: {
  status: RecordInvoicePaymentInput["status"];
  amountPaid: number | null;
  totalAmount: number;
}): AppResult<{ amountPaid: number }> {
  if (status === "Unpaid") {
    return { data: { amountPaid: 0 }, error: null };
  }

  if (status === "Paid") {
    return { data: { amountPaid: totalAmount }, error: null };
  }

  if (amountPaid === null || !Number.isFinite(amountPaid)) {
    return invalidPaymentAmount(
      "Nhập số tiền đã thu khi chọn thanh toán một phần.",
    );
  }

  if (amountPaid <= 0) {
    return invalidPaymentAmount("Số tiền đã thu phải lớn hơn 0.");
  }

  if (amountPaid >= totalAmount) {
    return invalidPaymentAmount(
      "Thanh toán một phần phải nhỏ hơn tổng tiền hóa đơn.",
    );
  }

  return {
    data: {
      amountPaid: roundMoney(amountPaid),
    },
    error: null,
  };
}

function invalidPaymentAmount(message: string): AppResult<never> {
  return appError({
    message,
    code: "INVALID_INVOICE_PAYMENT_AMOUNT",
    statusCode: 422,
  });
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
