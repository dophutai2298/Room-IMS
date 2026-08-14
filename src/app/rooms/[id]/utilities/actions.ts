"use server";

import { revalidatePath } from "next/cache";

import type { InvoiceGenerationActionState } from "./invoice-generation-state";
import {
  createApiTimer,
  logApiTiming,
  runWithApiTimer,
  type ApiTimer,
} from "@/lib/api/timing";
import { generateInvoiceFromUtilityMetrics } from "@/lib/insforge/rental-repository";
import { formatBillingPeriod } from "@/lib/utilities/presenter";

export async function generateMonthlyInvoice(
  _previousState: InvoiceGenerationActionState,
  formData: FormData,
): Promise<InvoiceGenerationActionState> {
  const timer = createApiTimer("invoice-generation.action");

  return runWithApiTimer(timer, async () => {
    try {
      const state = await timer.measure("service", () =>
        generateMonthlyInvoiceState(formData, timer),
      );

      return { ...state, timing: timer.snapshot() };
    } finally {
      logApiTiming(timer.snapshot());
    }
  });
}

async function generateMonthlyInvoiceState(
  formData: FormData,
  timer: ApiTimer,
): Promise<InvoiceGenerationActionState> {
  const roomId = String(formData.get("roomId") ?? "").trim();
  const monthRaw = String(formData.get("month") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();
  const otherFeeRaw = String(formData.get("otherFee") ?? "").trim();
  const otherFeeNoteRaw = String(formData.get("otherFeeNote") ?? "").trim();
  const fields = {
    otherFee: otherFeeRaw,
    otherFeeNote: otherFeeNoteRaw,
  };

  const month = parseInteger(monthRaw);
  const year = parseInteger(yearRaw);
  const otherFee = parseMoney(otherFeeRaw || "0");
  const fieldErrors: InvoiceGenerationActionState["fieldErrors"] = {};

  if (!roomId) {
    return {
      status: "error",
      message: "Không xác định được Phòng cần tạo hóa đơn.",
      invoiceId: null,
      fieldErrors,
      fields,
    };
  }

  if (month === null || month < 1 || month > 12) {
    fieldErrors.month = "Tháng phải nằm trong khoảng 1-12.";
  }

  if (year === null || year < 2010 || year > 2100) {
    fieldErrors.year = "Năm phải nằm trong khoảng 2010-2100.";
  }

  if (otherFee === null) {
    fieldErrors.otherFee = "Nhập phí không hợp lệ, hoặc để 0.";
  }

  if (otherFee !== null && otherFee > 0 && !otherFeeNoteRaw) {
    fieldErrors.otherFeeNote = "Nhập ghi chú để biết phí khác là phí gì.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Kiểm tra lại dữ liệu trước khi tạo hóa đơn.",
      invoiceId: null,
      fieldErrors,
      fields,
    };
  }

  const result = await timer.measure(
    "repository.insforge.invoice-generation",
    () =>
      generateInvoiceFromUtilityMetrics({
        roomId,
        billingPeriod: {
          month: month as number,
          year: year as number,
        },
        otherFee: otherFee as number,
        otherFeeNote: otherFeeNoteRaw || null,
      }),
  );

  if (result.error) {
    return {
      status: "error",
      message: result.error.message,
      invoiceId: null,
      fieldErrors,
      fields,
    };
  }

  revalidatePath("/");
  revalidatePath("/invoices");
  revalidatePath("/rooms");
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/rooms/${roomId}/utilities`);

  return {
    status: "success",
    message: `Đã tạo/cập nhật hóa đơn kỳ ${formatBillingPeriod({
      month: month as number,
      year: year as number,
    })}.`,
    invoiceId: result.data.id,
    fieldErrors: {},
    fields: {
      otherFee: String(result.data.other_fee),
      otherFeeNote: result.data.other_fee_note ?? "",
    },
  };
}

function parseInteger(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseMoney(value: string) {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}
