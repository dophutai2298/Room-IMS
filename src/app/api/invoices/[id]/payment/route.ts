import { validationApiError, type ApiError } from "@/lib/api/errors";
import { createInsForgeInvoiceRepository } from "@/lib/insforge/invoice-repository";
import type { InvoiceRecord } from "@/lib/insforge/types";
import { recordInvoicePaymentForOperations } from "@/lib/invoices/service";
import {
  existingDataMutationForbiddenMessage,
  landlordOnlyRoles,
} from "@/lib/server/role-policy";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const PATCH = withOperationalAuth(
  {
    operation: "invoices.payment.update",
    allowedRoles: landlordOnlyRoles,
    forbiddenMessage: existingDataMutationForbiddenMessage,
  },
  async ({ timer }, request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const validation = await timer.measure("validation", async () =>
      validatePaymentRequest({ invoiceId: id, request }),
    );

    if (validation.error) {
      return validation.error;
    }

    const repository = createInsForgeInvoiceRepository({ timer });
    return timer.measure("service", () =>
      recordInvoicePaymentForOperations({
        repository,
        invoiceId: id,
        status: validation.data.status,
        amountPaid: validation.data.amountPaid,
      }),
    );
  },
);

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
