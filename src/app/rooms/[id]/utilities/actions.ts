"use server";

import { revalidatePath } from "next/cache";

import type { UtilityMetricsActionState } from "./action-state";
import { saveUtilityMetrics } from "@/lib/insforge/rental-repository";
import { formatBillingPeriod } from "@/lib/utilities/presenter";

export async function saveMonthlyUtilityMetrics(
  _previousState: UtilityMetricsActionState,
  formData: FormData,
): Promise<UtilityMetricsActionState> {
  const roomId = String(formData.get("roomId") ?? "").trim();
  const monthRaw = String(formData.get("month") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();
  const electricityNewRaw = String(formData.get("electricityNew") ?? "").trim();
  const waterNewRaw = String(formData.get("waterNew") ?? "").trim();
  const fields = {
    electricityNew: electricityNewRaw,
    waterNew: waterNewRaw,
  };

  const month = parseInteger(monthRaw);
  const year = parseInteger(yearRaw);
  const electricityNew = parseReading(electricityNewRaw);
  const waterNew = parseReading(waterNewRaw);
  const fieldErrors: UtilityMetricsActionState["fieldErrors"] = {};

  if (!roomId) {
    return {
      status: "error",
      message: "Không xác định được Room cần chốt chỉ số.",
      fieldErrors,
      fields,
    };
  }

  if (month === null || month < 1 || month > 12) {
    fieldErrors.month = "Tháng phải nằm trong khoảng 1–12.";
  }

  if (year === null || year < 2000 || year > 2100) {
    fieldErrors.year = "Năm phải nằm trong khoảng 2000–2100.";
  }

  if (electricityNew === null) {
    fieldErrors.electricityNew = "Nhập chỉ số điện mới hợp lệ.";
  }

  if (waterNew === null) {
    fieldErrors.waterNew = "Nhập chỉ số nước mới hợp lệ.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Kiểm tra lại các chỉ số trước khi lưu.",
      fieldErrors,
      fields,
    };
  }

  const result = await saveUtilityMetrics({
    roomId,
    billingPeriod: {
      month: month as number,
      year: year as number,
    },
    electricityNew: electricityNew as number,
    waterNew: waterNew as number,
  });

  if (result.error) {
    if (result.error.code === "ELECTRICITY_READING_ROLLBACK") {
      fieldErrors.electricityNew = result.error.message;
    }

    if (result.error.code === "WATER_READING_ROLLBACK") {
      fieldErrors.waterNew = result.error.message;
    }

    return {
      status: "error",
      message: result.error.message,
      fieldErrors,
      fields,
    };
  }

  revalidatePath("/");
  revalidatePath("/rooms");
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/rooms/${roomId}/utilities`);

  return {
    status: "success",
    message: `Đã lưu chỉ số điện nước kỳ ${formatBillingPeriod({
      month: month as number,
      year: year as number,
    })}.`,
    fieldErrors: {},
    fields: {
      electricityNew: String(result.data.electricity_new),
      waterNew: String(result.data.water_new),
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

function parseReading(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}
