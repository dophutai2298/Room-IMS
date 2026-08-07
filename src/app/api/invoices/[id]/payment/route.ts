import { validationApiError, type ApiError } from "@/lib/api/errors";
import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { createInsForgeInvoiceRepository } from "@/lib/insforge/invoice-repository";
import type { InvoiceRecord } from "@/lib/insforge/types";
import { recordInvoicePaymentForOperations } from "@/lib/invoices/service";
import { resolveOperationalAppUser } from "@/lib/server/operational-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const timer = createApiTimer("invoices.payment.update");

  try {
    const { id } = await params;
    const validation = await timer.measure("validation", async () =>
      validatePaymentRequest({ invoiceId: id, request }),
    );

    if (validation.error) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(validation.error, meta);
    }

    const auth = await resolveOperationalAppUser({ timer });

    if (auth.error) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(auth.error, meta);
    }

    const repository = createInsForgeInvoiceRepository({ timer });
    const result = await timer.measure("service", () =>
      recordInvoicePaymentForOperations({
        repository,
        invoiceId: id,
        status: validation.data.status,
        amountPaid: validation.data.amountPaid,
      }),
    );
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);

    return apiResult(result, meta);
  } catch (error) {
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);

    return apiException(error, meta);
  }
}

type ValidationResult<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };

async function validatePaymentRequest({
  invoiceId,
  request,
}: {
  invoiceId: string;
  request: Request;
}): Promise<
  ValidationResult<{
    status: InvoiceRecord["status"];
    amountPaid: number | null;
  }>
> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const status = parseInvoiceStatus(body?.status);
  const amountPaid = parseOptionalMoney(body?.amountPaid);
  const fieldErrors: Record<string, string> = {};

  if (!invoiceId) {
    fieldErrors.id = "Invoice id is required.";
  }

  if (!status) {
    fieldErrors.status = "Chọn trạng thái thanh toán hợp lệ.";
  }

  if (amountPaid === "invalid") {
    fieldErrors.amountPaid = "Nhập số tiền đã thu hợp lệ.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      data: null,
      error: validationApiError({
        message: "Kiểm tra lại thông tin thanh toán trước khi lưu.",
        details: { fieldErrors },
      }),
    };
  }

  const validatedAmountPaid = amountPaid === "invalid" ? null : amountPaid;

  return {
    data: {
      status: status as InvoiceRecord["status"],
      amountPaid: validatedAmountPaid,
    },
    error: null,
  };
}

function parseInvoiceStatus(value: unknown): InvoiceRecord["status"] | null {
  if (value === "Unpaid" || value === "Partially Paid" || value === "Paid") {
    return value;
  }

  return null;
}

function parseOptionalMoney(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? roundMoney(value) : "invalid";
  }

  if (typeof value !== "string") {
    return "invalid";
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? roundMoney(parsed) : "invalid";
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
