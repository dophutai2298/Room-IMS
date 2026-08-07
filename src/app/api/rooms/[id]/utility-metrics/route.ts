import { validationApiError, type ApiError } from "@/lib/api/errors";
import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { createInsForgeUtilityMetricsRepository } from "@/lib/insforge/utility-metrics-repository";
import { resolveOperationalAppUser } from "@/lib/server/operational-auth";
import {
  getUtilityMetricsForOperations,
  saveUtilityMetricsForOperations,
} from "@/lib/utilities/service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const timer = createApiTimer("utility-metrics.read");

  try {
    const { id } = await params;
    const validation = await timer.measure("validation", async () =>
      validateReadRequest({ roomId: id, request }),
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

    const repository = createInsForgeUtilityMetricsRepository({ timer });
    const result = await timer.measure("service", () =>
      getUtilityMetricsForOperations({
        repository,
        roomId: id,
        billingPeriod: validation.data.billingPeriod,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const timer = createApiTimer("utility-metrics.save");

  try {
    const { id } = await params;
    const validation = await timer.measure("validation", async () =>
      validateSaveRequest({ roomId: id, request }),
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

    const repository = createInsForgeUtilityMetricsRepository({ timer });
    const result = await timer.measure("service", () =>
      saveUtilityMetricsForOperations({
        repository,
        roomId: id,
        billingPeriod: validation.data.billingPeriod,
        electricityNew: validation.data.electricityNew,
        waterNew: validation.data.waterNew,
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

function validateReadRequest({
  roomId,
  request,
}: {
  roomId: string;
  request: Request;
}): ValidationResult<{
  billingPeriod: { month: number; year: number };
}> {
  const url = new URL(request.url);

  return validateBillingPeriod({
    roomId,
    month: url.searchParams.get("month"),
    year: url.searchParams.get("year"),
  });
}

async function validateSaveRequest({
  roomId,
  request,
}: {
  roomId: string;
  request: Request;
}): Promise<
  ValidationResult<{
    billingPeriod: { month: number; year: number };
    electricityNew: number;
    waterNew: number;
  }>
> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const billingPeriod = validateBillingPeriod({
    roomId,
    month: body?.month,
    year: body?.year,
  });

  if (billingPeriod.error) {
    return billingPeriod;
  }

  const electricityNew = parseReading(body?.electricityNew);
  const waterNew = parseReading(body?.waterNew);
  const fieldErrors: Record<string, string> = {};

  if (electricityNew === null) {
    fieldErrors.electricityNew = "Nhập chỉ số điện mới hợp lệ.";
  }

  if (waterNew === null) {
    fieldErrors.waterNew = "Nhập chỉ số nước mới hợp lệ.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      data: null,
      error: validationApiError({
        message: "Kiểm tra lại chỉ số điện nước trước khi lưu.",
        details: { fieldErrors },
      }),
    };
  }

  return {
    data: {
      billingPeriod: billingPeriod.data.billingPeriod,
      electricityNew: electricityNew as number,
      waterNew: waterNew as number,
    },
    error: null,
  };
}

function validateBillingPeriod({
  roomId,
  month,
  year,
}: {
  roomId: string;
  month: unknown;
  year: unknown;
}): ValidationResult<{
  billingPeriod: { month: number; year: number };
}> {
  const parsedMonth = parseInteger(month);
  const parsedYear = parseInteger(year);
  const fieldErrors: Record<string, string> = {};

  if (!roomId) {
    fieldErrors.id = "room id is required";
  }

  if (parsedMonth === null || parsedMonth < 1 || parsedMonth > 12) {
    fieldErrors.month = "Month must be between 1 and 12.";
  }

  if (parsedYear === null || parsedYear < 2000 || parsedYear > 2100) {
    fieldErrors.year = "Year must be between 2000 and 2100.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      data: null,
      error: validationApiError({
        message: "Invalid Utility Metrics request.",
        details: { fieldErrors },
      }),
    };
  }

  return {
    data: {
      billingPeriod: {
        month: parsedMonth as number,
        year: parsedYear as number,
      },
    },
    error: null,
  };
}

function parseInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value !== "string" || !value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseReading(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value !== "string" || !value) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}
