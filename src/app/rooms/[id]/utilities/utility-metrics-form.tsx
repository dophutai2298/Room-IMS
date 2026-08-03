"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { initialUtilityMetricsActionState } from "./action-state";
import { saveMonthlyUtilityMetrics } from "./actions";
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
import type { UtilityMetricsView, UtilityReadingView } from "@/lib/utilities/presenter";

export function UtilityMetricsForm({ view }: { view: UtilityMetricsView }) {
  const [state, formAction] = useActionState(
    saveMonthlyUtilityMetrics,
    initialUtilityMetricsActionState,
  );
  const [electricityNew, setElectricityNew] = useState(
    state?.fields?.electricityNew || valueToInput(view?.electricity?.newReading),
  );
  const [waterNew, setWaterNew] = useState(
    state?.fields?.waterNew || valueToInput(view?.water?.newReading),
  );
  const electricityValidation = useReadingValidation(
    electricityNew,
    view?.electricity?.oldReading,
  );
  const waterValidation = useReadingValidation(waterNew, view?.water?.oldReading);
  const hasClientErrors =
    Boolean(electricityValidation.error) || Boolean(waterValidation.error);
  const electricityConsumption = getConsumption(
    electricityNew,
    view.electricity.oldReading,
  );
  const waterConsumption = getConsumption(waterNew, view.water.oldReading);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="roomId" value={view.room.id} />
      <input type="hidden" name="month" value={view.billingPeriod.month} />
      <input type="hidden" name="year" value={view.billingPeriod.year} />

      <div className="grid gap-4 lg:grid-cols-2">
        <MetricFormCard
          title="Chỉ số điện"
          description="Điện được tính theo kWh."
          inputName="electricityNew"
          inputId="electricity-current"
          placeholder="Nhập chỉ số điện mới"
          reading={view.electricity}
          value={electricityNew}
          onChange={setElectricityNew}
          consumption={electricityConsumption}
          clientError={electricityValidation.error}
          serverError={state?.fieldErrors?.electricityNew}
        />
        <MetricFormCard
          title="Chỉ số nước"
          description="Nước được tính theo m³."
          inputName="waterNew"
          inputId="water-current"
          placeholder="Nhập chỉ số nước mới"
          reading={view.water}
          value={waterNew}
          onChange={setWaterNew}
          consumption={waterConsumption}
          clientError={waterValidation.error}
          serverError={state?.fieldErrors?.waterNew}
        />
      </div>

      {state.message && (
        <p
          className={
            state.status === "success"
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
              : "rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          }
        >
          {state.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {view.persistedMetricId
            ? "Kỳ này đã có chỉ số; lưu lại sẽ cập nhật record hiện có."
            : "Kỳ này chưa có chỉ số; lưu sẽ tạo record đầu tiên cho phòng."}
        </p>
        <SaveButton disabled={hasClientErrors} />
      </div>
    </form>
  );
}

function MetricFormCard({
  title,
  description,
  inputName,
  inputId,
  placeholder,
  reading,
  value,
  onChange,
  consumption,
  clientError,
  serverError,
}: {
  title: string;
  description: string;
  inputName: string;
  inputId: string;
  placeholder: string;
  reading: UtilityReadingView;
  value: string;
  onChange: (value: string) => void;
  consumption: number | null;
  clientError: string | null;
  serverError?: string;
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
              name={inputName}
              inputMode="decimal"
              min={reading.oldReading}
              placeholder={placeholder}
              type="number"
              step="0.01"
              value={value}
              aria-invalid={Boolean(error)}
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

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

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
