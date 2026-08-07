"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppApiClientError, fetchAppApi } from "@/lib/api/client";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import type { UtilityMetricRecord } from "@/lib/insforge/types";
import { invoiceQueryKeys } from "@/lib/invoices/query-keys";
import { roomQueryKeys } from "@/lib/rooms/query-keys";
import type { UtilityMetricsView, UtilityReadingView } from "@/lib/utilities/presenter";
import { utilityMetricsQueryKeys } from "@/lib/utilities/query-keys";

export function UtilityMetricsForm({ view }: { view: UtilityMetricsView }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{
    status: "success" | "error";
    text: string;
  } | null>(null);
  const [electricityNew, setElectricityNew] = useState(
    valueToInput(view.electricity.newReading),
  );
  const [waterNew, setWaterNew] = useState(valueToInput(view.water.newReading));

  const saveMutation = useMutation({
    mutationFn: (input: { electricityNew: string; waterNew: string }) =>
      fetchAppApi<UtilityMetricRecord>(
        `/api/rooms/${view.room.id}/utility-metrics`,
        {
          method: "PATCH",
          cache: "no-store",
          body: JSON.stringify({
            month: view.billingPeriod.month,
            year: view.billingPeriod.year,
            electricityNew: input.electricityNew,
            waterNew: input.waterNew,
          }),
        },
      ),
    onSuccess: async (metric) => {
      setElectricityNew(String(metric.electricity_new));
      setWaterNew(String(metric.water_new));

      const successMessage = `Đã lưu chỉ số điện nước kỳ ${view.periodLabel}.`;
      setMessage({
        status: "success",
        text: successMessage,
      });
      toast.success(successMessage);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: utilityMetricsQueryKeys.room(view.room.id),
        }),
        queryClient.invalidateQueries({
          queryKey: roomQueryKeys.detail(view.room.id),
        }),
        queryClient.invalidateQueries({
          queryKey: roomQueryKeys.operationsSummary(view.room.id),
        }),
        queryClient.invalidateQueries({
          queryKey: invoiceQueryKeys.list(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.all,
        }),
      ]);
    },
    onError: (error) => {
      const text =
        error instanceof Error
          ? error.message
          : "Không lưu được chỉ số điện nước.";

      setMessage({
        status: "error",
        text,
      });
      toast.error(text);
    },
  });

  const electricityValidation = useReadingValidation(
    electricityNew,
    view.electricity.oldReading,
  );
  const waterValidation = useReadingValidation(waterNew, view.water.oldReading);
  const hasClientErrors =
    Boolean(electricityValidation.error) || Boolean(waterValidation.error);
  const electricityConsumption = getConsumption(
    electricityNew,
    view.electricity.oldReading,
  );
  const waterConsumption = getConsumption(waterNew, view.water.oldReading);
  const electricityServerError = getMutationFieldError(
    saveMutation.error,
    "electricityNew",
  );
  const waterServerError = getMutationFieldError(saveMutation.error, "waterNew");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (hasClientErrors || saveMutation.isPending) {
      return;
    }

    setMessage(null);
    saveMutation.mutate({
      electricityNew,
      waterNew,
    });
  }

  function handleElectricityChange(value: string) {
    clearServerFeedback();
    setElectricityNew(value);
  }

  function handleWaterChange(value: string) {
    clearServerFeedback();
    setWaterNew(value);
  }

  function clearServerFeedback() {
    if (saveMutation.isError) {
      saveMutation.reset();
    }

    if (message?.status === "error") {
      setMessage(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <MetricFormCard
          title="Chỉ số điện"
          description="Điện được tính theo kWh."
          inputId="electricity-current"
          placeholder="Nhập chỉ số điện mới"
          reading={view.electricity}
          value={electricityNew}
          onChange={handleElectricityChange}
          consumption={electricityConsumption}
          clientError={electricityValidation.error}
          serverError={electricityServerError}
          disabled={saveMutation.isPending}
        />
        <MetricFormCard
          title="Chỉ số nước"
          description="Nước được tính theo m³."
          inputId="water-current"
          placeholder="Nhập chỉ số nước mới"
          reading={view.water}
          value={waterNew}
          onChange={handleWaterChange}
          consumption={waterConsumption}
          clientError={waterValidation.error}
          serverError={waterServerError}
          disabled={saveMutation.isPending}
        />
      </div>

      {message && (
        <p
          className={
            message.status === "success"
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
              : "rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          }
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {view.persistedMetricId
            ? "Kỳ này đã có chỉ số; lưu lại sẽ cập nhật record hiện có."
            : "Kỳ này chưa có chỉ số; lưu sẽ tạo record đầu tiên cho phòng."}
        </p>
        <SaveButton disabled={hasClientErrors} pending={saveMutation.isPending} />
      </div>
    </form>
  );
}

function MetricFormCard({
  title,
  description,
  inputId,
  placeholder,
  reading,
  value,
  onChange,
  consumption,
  clientError,
  serverError,
  disabled,
}: {
  title: string;
  description: string;
  inputId: string;
  placeholder: string;
  reading: UtilityReadingView;
  value: string;
  onChange: (value: string) => void;
  consumption: number | null;
  clientError: string | null;
  serverError?: string;
  disabled: boolean;
}) {
  const error = clientError ?? serverError ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="secondary">{reading.unit}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`${inputId}-previous`}>Chỉ số cũ</Label>
            <Input
              id={`${inputId}-previous`}
              value={formatNumber(reading.oldReading)}
              disabled
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={inputId}>Chỉ số mới</Label>
            <Input
              id={inputId}
              inputMode="decimal"
              min={reading.oldReading}
              placeholder={placeholder}
              type="number"
              step="0.01"
              value={value}
              aria-invalid={Boolean(error)}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
            />
            <p
              className={
                error ? "text-xs text-destructive" : "text-xs text-muted-foreground"
              }
            >
              {error ?? "Giá trị mới phải lớn hơn hoặc bằng chỉ số cũ."}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/40 bg-muted/40 p-4 clay-inset dark:border-white/8">
          <p className="text-sm text-muted-foreground">Lượng tiêu thụ</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
            {consumption === null ? "—" : formatNumber(consumption)} {reading.unit}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SaveButton({
  disabled,
  pending,
}: {
  disabled: boolean;
  pending: boolean;
}) {
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? "Đang lưu..." : "Lưu chỉ số"}
    </Button>
  );
}

function useReadingValidation(value: string, oldReading: number) {
  return useMemo(() => {
    if (!value) {
      return { error: null };
    }

    const parsed = Number.parseFloat(value);

    if (!Number.isFinite(parsed)) {
      return { error: "Nhập một số hợp lệ." };
    }

    if (parsed < oldReading) {
      return { error: "Chỉ số mới không được thấp hơn chỉ số cũ." };
    }

    return { error: null };
  }, [oldReading, value]);
}

function getConsumption(value: string, oldReading: number) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < oldReading) {
    return null;
  }

  return parsed - oldReading;
}

function valueToInput(value: number | null) {
  return value === null ? "" : String(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function getMutationFieldError(error: Error | null, field: string) {
  if (!(error instanceof AppApiClientError)) {
    return undefined;
  }

  if (
    field === "electricityNew" &&
    error.code === "ELECTRICITY_READING_ROLLBACK"
  ) {
    return error.message;
  }

  if (field === "waterNew" && error.code === "WATER_READING_ROLLBACK") {
    return error.message;
  }

  const fieldErrors = getFieldErrors(error.details);
  const fieldError = fieldErrors[field];

  return typeof fieldError === "string" ? fieldError : undefined;
}

function getFieldErrors(details: unknown): Record<string, unknown> {
  if (
    typeof details !== "object" ||
    details === null ||
    !("fieldErrors" in details)
  ) {
    return {};
  }

  const fieldErrors = details.fieldErrors;

  return typeof fieldErrors === "object" && fieldErrors !== null
    ? (fieldErrors as Record<string, unknown>)
    : {};
}
