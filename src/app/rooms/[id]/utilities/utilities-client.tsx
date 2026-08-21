"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceGenerationForm } from "./invoice-generation-form";
import { UtilityMetricsForm } from "./utility-metrics-form";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAppApi } from "@/lib/api/client";
import { AppApiClientError } from "@/lib/api/client";
import {
  formatBillingPeriod,
  type BillingPeriod,
  type UtilityMetricsView,
} from "@/lib/utilities/presenter";
import { utilityMetricsQueryKeys } from "@/lib/utilities/query-keys";

export function UtilitiesClient({
  roomId,
  billingPeriod,
}: {
  roomId: string;
  billingPeriod: BillingPeriod;
}) {
  const metricsQuery = useQuery({
    queryKey: utilityMetricsQueryKeys.screen(roomId, billingPeriod),
    queryFn: () =>
      fetchAppApi<UtilityMetricsView>(
        `/api/rooms/${roomId}/utility-metrics?month=${billingPeriod.month}&year=${billingPeriod.year}`,
        // {
        //   cache: "no-store",
        // },
      ),
  });

  if (metricsQuery.isPending) {
    return (
      <>
        <UtilitiesHeaderSkeleton
          roomId={roomId}
          billingPeriod={billingPeriod}
        />
        <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <MetricsFormSkeleton />
          <aside className="space-y-4">
            <SummarySkeleton title={`Tóm tắt kỳ ${formatBillingPeriod(billingPeriod)}`} />
            <SummarySkeleton title={`Hóa đơn kỳ ${formatBillingPeriod(billingPeriod)}`} />
          </aside>
        </section>
      </>
    );
  }

  if (metricsQuery.isError) {
    if (
      metricsQuery.error instanceof AppApiClientError &&
      metricsQuery.error.status === 404
    ) {
      notFound();
    }

    return (
      <>
        <UtilitiesHeaderFallback
          roomId={roomId}
          billingPeriod={billingPeriod}
        />
        <ErrorCard
          title="Không tải được chỉ số điện nước"
          message={metricsQuery.error.message}
          onRetry={() => void metricsQuery.refetch()}
        />
      </>
    );
  }

  const view = metricsQuery.data;

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href={`/rooms/${view.room.id}`}>← Quay lại chi tiết phòng</Link>
          </Button>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Chốt điện nước kỳ {view.periodLabel}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {view.room.name} · {view.keyTenantName ?? "Chưa có Key Tenant"}
          </p>
        </div>
        <PeriodSelector roomId={view.room.id} billingPeriod={billingPeriod} />
      </header>

      <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <UtilityMetricsForm
          key={`${view.room.id}-${view.periodLabel}`}
          view={view}
        />
        <aside className="space-y-4">
          <SummaryCard view={view} />
          <InvoiceGenerationForm
            key={`${view.room.id}-${view.periodLabel}`}
            view={view}
          />
        </aside>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button asChild variant="secondary">
          <Link href={`/rooms/${view.room.id}`}>Hủy bỏ</Link>
        </Button>
      </div>
    </>
  );
}

function UtilitiesHeaderFallback({
  roomId,
  billingPeriod,
}: {
  roomId: string;
  billingPeriod: BillingPeriod;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href={`/rooms/${roomId}`}>← Quay lại chi tiết phòng</Link>
        </Button>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
          Chốt điện nước kỳ {formatBillingPeriod(billingPeriod)}
        </h1>
      </div>
      <PeriodSelector roomId={roomId} billingPeriod={billingPeriod} />
    </header>
  );
}

function UtilitiesHeaderSkeleton({
  roomId,
  billingPeriod,
}: {
  roomId: string;
  billingPeriod: BillingPeriod;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href={`/rooms/${roomId}`}>← Quay lại chi tiết phòng</Link>
        </Button>
        <Skeleton className="h-12 w-[28rem] max-w-full" />
        <Skeleton className="h-5 w-60" />
      </div>
      <PeriodSelector roomId={roomId} billingPeriod={billingPeriod} />
    </header>
  );
}

function PeriodSelector({
  roomId,
  billingPeriod,
}: {
  roomId: string;
  billingPeriod: BillingPeriod;
}) {
  return (
    <Card className="w-full lg:w-[24rem]">
      <CardHeader>
        <CardTitle>Kỳ ghi chỉ số</CardTitle>
        <CardDescription>Chọn tháng/năm để xem hoặc cập nhật record.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={`/rooms/${roomId}/utilities`}
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <div className="grid gap-2">
            <Label htmlFor="period-month">Tháng</Label>
            <Input
              id="period-month"
              name="month"
              type="number"
              min={1}
              max={12}
              defaultValue={billingPeriod.month}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="period-year">Năm</Label>
            <Input
              id="period-year"
              name="year"
              type="number"
              min={2000}
              max={2100}
              defaultValue={billingPeriod.year}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="secondary" className="w-full">
              Xem
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ view }: { view: UtilityMetricsView }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Tóm tắt kỳ {view.periodLabel}</CardTitle>
            <CardDescription>
              Dữ liệu đọc qua API nội bộ từ bảng utility_metrics trên InsForge.
            </CardDescription>
          </div>
          <Badge variant={view.persistedMetricId ? "success" : "warning"}>
            {view.persistedMetricId ? "Đã lưu" : "Chưa lưu"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <DetailRow
            label="Nguồn chỉ số cũ"
            value={
              view.persistedMetricId
                ? `Record kỳ ${view.periodLabel}`
                : view.previousPeriodLabel
                  ? `Kỳ trước gần nhất ${view.previousPeriodLabel}`
                  : "Chưa có kỳ trước, bắt đầu từ 0"
            }
          />
          <DetailRow
            label="Điện tiêu thụ"
            value={formatConsumption(view.electricity.consumption, view.electricity.unit)}
          />
          <DetailRow
            label="Nước tiêu thụ"
            value={formatConsumption(view.water.consumption, view.water.unit)}
          />
          <DetailRow
            label="Active Contract"
            value={view.activeContractId ? "Có" : "Chưa có"}
          />
        </div>
        <Separator />
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 text-sm text-amber-800 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.5)] dark:border-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
          Lưu cùng Room và cùng kỳ sẽ cập nhật record hiện có, không tạo duplicate.
        </div>
      </CardContent>
    </Card>
  );
}

function MetricsFormSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-live="polite">
      <SummarySkeleton title="Chỉ số điện" />
      <SummarySkeleton title="Chỉ số nước" />
    </div>
  );
}

function SummarySkeleton({ title }: { title: string }) {
  return (
    <Card aria-busy="true" aria-live="polite">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Skeleton className="h-4 w-64 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function ErrorCard({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-destructive/20">
      <CardContent className="space-y-3">
        <Badge variant="destructive">Lỗi API</Badge>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="secondary" onClick={onRetry}>
          Thử lại
        </Button>
      </CardContent>
    </Card>
  );
}

function formatConsumption(value: number | null, unit: string) {
  if (value === null) {
    return "Chưa nhập";
  }

  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(value)} ${unit}`;
}
