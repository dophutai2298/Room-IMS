"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAppApi } from "@/lib/api/client";
import {
  buildDashboardRoomAvailabilityFromItems,
  type DashboardMissingUtilityMetricsView,
  type DashboardRevenueView,
  type DashboardRoomAvailabilityView,
  type DashboardRoomStatusItem,
  type DashboardUnpaidInvoice,
  type DashboardUnpaidInvoicesView,
} from "@/lib/dashboard/presenter";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import {
  DASHBOARD_REVENUE_RANGE_OPTIONS,
  DEFAULT_DASHBOARD_REVENUE_RANGE,
  getDashboardRevenueRangeDetails,
  normalizeDashboardRevenueRange,
  type DashboardRevenueRange,
} from "@/lib/dashboard/revenue-range";
import { formatCurrency } from "@/lib/formatters";
import { invoiceStatusLabel } from "@/lib/invoices/presenter";
import {
  roomStatusLabel,
  type RoomListItem,
  type RoomUiStatus,
} from "@/lib/rooms/presenter";
import { roomQueryKeys } from "@/lib/rooms/query-keys";
import { formatBillingPeriod, type BillingPeriod } from "@/lib/utilities/presenter";

const dashboardQueryOptions = {
  staleTime: 30_000,
  refetchInterval: 60_000,
  refetchIntervalInBackground: false,
};

export function DashboardClient({
  billingPeriod,
}: {
  billingPeriod: BillingPeriod;
}) {
  const [chartRange, setChartRange] = useState<DashboardRevenueRange>(
    DEFAULT_DASHBOARD_REVENUE_RANGE,
  );
  const revenueSummaryQuery = useDashboardRevenueQuery({
    billingPeriod,
    chartRange: DEFAULT_DASHBOARD_REVENUE_RANGE,
  });
  const revenueChartQuery = useDashboardRevenueQuery({
    billingPeriod,
    chartRange,
  });
  const availabilityQuery = useQuery({
    queryKey: roomQueryKeys.list(),
    queryFn: () =>
      fetchAppApi<RoomListItem[]>(
        "/api/rooms",
        { cache: "no-store" },
      ),
    select: buildDashboardRoomAvailabilityFromItems,
    ...dashboardQueryOptions,
  });
  const missingMetricsQuery = useQuery({
    queryKey: dashboardQueryKeys.missingUtilityMetrics(billingPeriod),
    queryFn: () =>
      fetchAppApi<DashboardMissingUtilityMetricsView>(
        `/api/dashboard/missing-utility-metrics?${periodSearchParams(billingPeriod)}`,
        { cache: "no-store" },
      ),
    ...dashboardQueryOptions,
  });
  const unpaidInvoicesQuery = useQuery({
    queryKey: dashboardQueryKeys.unpaidInvoices(billingPeriod),
    queryFn: () =>
      fetchAppApi<DashboardUnpaidInvoicesView>(
        `/api/dashboard/unpaid-invoices?${periodSearchParams(billingPeriod)}`,
        { cache: "no-store" },
      ),
    ...dashboardQueryOptions,
  });
  const periodLabel = formatBillingPeriod(billingPeriod);

  return (
    <>
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-primary">{periodLabel}</p>
            <span className="size-1 rounded-full bg-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Hệ thống quản lý phòng trọ Xin chào</p>
          </div>
          <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Mọi việc bạn cần quản lý, gom lại vào một hệ thống.
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
            Dashboard tự đọc hóa đơn, chỉ số điện nước và trạng thái phòng
            đã xác thực để bạn chốt kỳ nhanh hơn.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="secondary">
            <Link href="/invoices">Hóa đơn</Link>
          </Button>
          <Button asChild>
            <Link href="/rooms">Quản lý phòng</Link>
          </Button>
        </div>
      </header>

      <section aria-label="Chỉ số vận hành" className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        <MetricCard
          className="xl:col-span-4"
          label="Đã thu trong kỳ"
          value={
            revenueSummaryQuery.data
              ? formatCurrency(revenueSummaryQuery.data.collectedRevenue)
              : undefined
          }
          note={
            revenueSummaryQuery.data
              ? `${revenueSummaryQuery.data.invoiceCount} hóa đơn kỳ ${revenueSummaryQuery.data.periodLabel}`
              : "Đang đọc doanh thu"
          }
          tone="success"
          isLoading={revenueSummaryQuery.isPending}
          error={revenueSummaryQuery.error?.message}
          onRetry={() => void revenueSummaryQuery.refetch()}
        />
        <MetricCard
          className="xl:col-span-3"
          label="Công nợ"
          value={
            revenueSummaryQuery.data
              ? formatCurrency(revenueSummaryQuery.data.outstandingDebt)
              : undefined
          }
          note="Chưa thu hoặc thu một phần"
          tone="warning"
          isLoading={revenueSummaryQuery.isPending}
          error={revenueSummaryQuery.error?.message}
          onRetry={() => void revenueSummaryQuery.refetch()}
        />
        <MetricCard
          className="xl:col-span-3"
          label="Tỷ lệ lấp đầy"
          value={
            availabilityQuery.data
              ? `${availabilityQuery.data.occupancyRate}%`
              : undefined
          }
          note={
            availabilityQuery.data
              ? `${availabilityQuery.data.occupiedRooms}/${availabilityQuery.data.totalRooms} phòng đang thuê`
              : "Đang tính trạng thái phòng"
          }
          isLoading={availabilityQuery.isPending}
          error={availabilityQuery.error?.message}
          onRetry={() => void availabilityQuery.refetch()}
        />
        <MetricCard
          className="md:col-span-2 xl:col-span-2"
          label="Phòng trống"
          value={
            availabilityQuery.data
              ? String(availabilityQuery.data.availableRooms)
              : undefined
          }
          note="Có thể cho thuê"
          isLoading={availabilityQuery.isPending}
          error={availabilityQuery.error?.message}
          onRetry={() => void availabilityQuery.refetch()}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.7fr)]">
        <RevenueSection
          revenue={revenueChartQuery.data}
          isLoading={revenueChartQuery.isPending}
          error={revenueChartQuery.error?.message}
          onRetry={() => void revenueChartQuery.refetch()}
          range={chartRange}
          onRangeChange={setChartRange}
        />
        <MissingMetricsSection
          data={missingMetricsQuery.data}
          isLoading={missingMetricsQuery.isPending}
          error={missingMetricsQuery.error?.message}
          onRetry={() => void missingMetricsQuery.refetch()}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <UnpaidInvoicesSection
          data={unpaidInvoicesQuery.data}
          isLoading={unpaidInvoicesQuery.isPending}
          error={unpaidInvoicesQuery.error?.message}
          onRetry={() => void unpaidInvoicesQuery.refetch()}
        />
        <RoomAvailabilitySection
          data={availabilityQuery.data}
          isLoading={availabilityQuery.isPending}
          error={availabilityQuery.error?.message}
          onRetry={() => void availabilityQuery.refetch()}
        />
      </section>
    </>
  );
}

function useDashboardRevenueQuery({
  billingPeriod,
  chartRange,
}: {
  billingPeriod: BillingPeriod;
  chartRange: DashboardRevenueRange;
}) {
  return useQuery({
    queryKey: dashboardQueryKeys.revenue(billingPeriod, chartRange),
    queryFn: () =>
      fetchAppApi<DashboardRevenueView>(
        `/api/dashboard/revenue?${revenueSearchParams(billingPeriod, chartRange)}`,
        { cache: "no-store" },
      ),
    ...dashboardQueryOptions,
  });
}

function MetricCard({
  className,
  label,
  value,
  note,
  tone = "default",
  isLoading,
  error,
  onRetry,
}: {
  className?: string;
  label: string;
  value?: string;
  note: string;
  tone?: "default" | "warning" | "success";
  isLoading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent/70 text-lg font-semibold text-accent-foreground clay-inset">
            {tone === "success" ? "✓" : tone === "warning" ? "!" : "•"}
          </span>
        </div>
        <div className="mt-auto">
          {isLoading ? (
            <Skeleton className="h-8 w-40" />
          ) : error ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="secondary" onClick={onRetry}>
                Thử lại
              </Button>
            </div>
          ) : (
            <>
              <p
                className={
                  tone === "warning"
                    ? "font-mono text-2xl font-semibold text-amber-700 tabular-nums dark:text-amber-300"
                    : tone === "success"
                      ? "font-mono text-2xl font-semibold text-emerald-700 tabular-nums dark:text-emerald-300"
                      : "font-mono text-2xl font-semibold tracking-tight tabular-nums"
                }
              >
                {value}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{note}</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueSection({
  revenue,
  isLoading,
  error,
  onRetry,
  range,
  onRangeChange,
}: {
  revenue?: DashboardRevenueView;
  isLoading: boolean;
  error?: string;
  onRetry: () => void;
  range: DashboardRevenueRange;
  onRangeChange: (range: DashboardRevenueRange) => void;
}) {
  const rangeDetails = getDashboardRevenueRangeDetails(range);
  const title = `Dòng tiền ${rangeDetails.label}`;
  const description =
    range === "all"
      ? "So sánh số đã lập hóa đơn và thực thu theo toàn bộ lịch sử hóa đơn."
      : `So sánh số đã lập hóa đơn và thực thu theo tháng trong ${rangeDetails.label.toLowerCase()}.`;
  const emptyTitle =
    range === "all"
      ? "Chưa có lịch sử hóa đơn"
      : `Chưa có hóa đơn trong ${rangeDetails.label.toLowerCase()}`;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1.5">{description}</CardDescription>
          </div>
          <Select
            value={range}
            onValueChange={(value) =>
              onRangeChange(normalizeDashboardRevenueRange(value))
            }
          >
            <SelectTrigger
              aria-label="Khoảng thời gian biểu đồ doanh thu"
              className="w-full sm:w-44"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DASHBOARD_REVENUE_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <ChartLegend color="bg-chart-primary" label="Đã thu" />
          <ChartLegend color="bg-chart-secondary" label="Đã lập HĐ" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-72 w-full sm:h-80" />
        ) : error || !revenue ? (
          <InlineError message={error ?? "Không có dữ liệu doanh thu."} onRetry={onRetry} />
        ) : revenue.chartInvoiceCount === 0 ? (
          <EmptyState
            title={emptyTitle}
            body="Hãy tạo hóa đơn cho các kỳ phù hợp để theo dõi dòng tiền tại đây."
          />
        ) : (
          <RevenueChart data={revenue.chart} title={title} description={description} />
        )}
      </CardContent>
    </Card>
  );
}

function MissingMetricsSection({
  data,
  isLoading,
  error,
  onRetry,
}: {
  data?: DashboardMissingUtilityMetricsView;
  isLoading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <Card className="bg-primary text-primary-foreground dark:bg-primary/90">
      <CardHeader>
        <p className="text-sm font-medium text-primary-foreground/70">Ưu tiên hôm nay</p>
        <CardTitle className="text-2xl">Chốt chỉ số kỳ {data?.periodLabel ?? "hiện tại"}</CardTitle>
        <CardDescription className="text-primary-foreground/70">
          {data ? `${data.rooms.length} phòng còn thiếu Utility Metrics.` : "Đang kiểm tra phòng còn thiếu chỉ số."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <ReminderSkeleton dark />
        ) : error || !data ? (
          <InlineError
            message={error ?? "Không tải được nhắc việc điện nước."}
            onRetry={onRetry}
            dark
          />
        ) : data.rooms.length === 0 ? (
          <EmptyState
            title="Không có nhắc việc"
            body="Tất cả phòng đang thuê đã có chỉ số cho kỳ này."
            dark
          />
        ) : (
          data.rooms.map((room) => (
            <div
              key={room.id}
              className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{room.name}</p>
                  <p className="mt-1 text-sm text-primary-foreground/70">
                    {room.keyTenantName ?? "Chưa có Key Tenant"}
                  </p>
                </div>
                <span aria-hidden="true" className="text-xl">↗</span>
              </div>
              <Button asChild size="sm" variant="secondary" className="mt-4 w-full">
                <Link href={`/rooms/${room.id}/utilities`}>Nhập chỉ số</Link>
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function UnpaidInvoicesSection({
  data,
  isLoading,
  error,
  onRetry,
}: {
  data?: DashboardUnpaidInvoicesView;
  isLoading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Hóa đơn cần thu</CardTitle>
          <CardDescription className="mt-1.5">
            Ưu tiên theo số tiền còn lại trong kỳ.
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/invoices">Xem tất cả</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {isLoading ? (
          <ReminderSkeleton />
        ) : error || !data ? (
          <InlineError message={error ?? "Không tải được hóa đơn cần thu."} onRetry={onRetry} />
        ) : data.invoices.length === 0 ? (
          <EmptyState
            title="Không có công nợ kỳ này"
            body="Các hóa đơn trong kỳ đã được thanh toán hoặc chưa có hóa đơn cần thu."
          />
        ) : (
          <>
            <div className="rounded-2xl border border-white/40 bg-background/35 p-4 clay-inset dark:border-white/8">
              <p className="text-sm text-muted-foreground">Tổng còn phải thu</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                {formatCurrency(data.totalBalanceDue)}
              </p>
            </div>
            {data.invoices.map((invoice) => (
              <UnpaidInvoiceItem key={invoice.id} invoice={invoice} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function UnpaidInvoiceItem({ invoice }: { invoice: DashboardUnpaidInvoice }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{invoice.roomName}</p>
          <p className="mt-1 text-xs text-muted-foreground">{invoice.shortId}</p>
        </div>
        <InvoiceBadge status={invoice.status} />
      </div>
      <div className="grid gap-3 rounded-2xl border border-white/40 bg-background/35 p-4 clay-inset dark:border-white/8 sm:grid-cols-3">
        <Fact label="Tổng" value={formatCurrency(invoice.totalAmount)} />
        <Fact label="Đã thu" value={formatCurrency(invoice.amountPaid)} />
        <Fact label="Còn lại" value={formatCurrency(invoice.balanceDue)} />
      </div>
      <Button asChild variant="secondary" size="sm">
        <Link href={`/rooms/${invoice.roomId}/utilities`}>Xem kỳ thu</Link>
      </Button>
      <Separator />
    </div>
  );
}

function RoomAvailabilitySection({
  data,
  isLoading,
  error,
  onRetry,
}: {
  data?: DashboardRoomAvailabilityView;
  isLoading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nhịp vận hành các phòng</CardTitle>
        <CardDescription>
          Trạng thái được tính từ Room Status và active Contract hiện tại.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {isLoading ? (
          <>
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
          </>
        ) : error || !data ? (
          <div className="sm:col-span-2">
            <InlineError message={error ?? "Không tải được trạng thái phòng."} onRetry={onRetry} />
          </div>
        ) : data.rooms.length === 0 ? (
          <div className="sm:col-span-2">
            <EmptyState
              title="Chưa có phòng"
              body="Khi rooms được seed hoặc tạo mới, dashboard sẽ hiển thị trạng thái tại đây."
            />
          </div>
        ) : (
          data.rooms.map((room) => <RoomStatusLink key={room.id} room={room} />)
        )}
      </CardContent>
    </Card>
  );
}

function RoomStatusLink({ room }: { room: DashboardRoomStatusItem }) {
  return (
    <Link
      href={`/rooms/${room.id}`}
      className="group rounded-2xl border border-white/50 bg-background/35 p-4 clay-inset outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring dark:border-white/8"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{room.name}</p>
        <RoomBadge status={room.status} />
      </div>
      <p className="mt-3 line-clamp-1 text-sm text-muted-foreground">
        {room.keyTenantName ?? "Chưa có Key Tenant"}
      </p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="font-mono text-sm font-semibold tabular-nums">
          {formatCurrency(room.basePrice)}
        </p>
        <span aria-hidden="true" className="text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </Link>
  );
}

function InlineError({
  message,
  onRetry,
  dark = false,
}: {
  message: string;
  onRetry: () => void;
  dark?: boolean;
}) {
  return (
    <div
      className={
        dark
          ? "rounded-2xl border border-white/20 bg-white/10 p-4"
          : "rounded-2xl border border-destructive/20 bg-destructive/10 p-4"
      }
    >
      <p className={dark ? "text-sm text-primary-foreground/80" : "text-sm text-destructive"}>
        {message}
      </p>
      <Button className="mt-3" size="sm" variant="secondary" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  );
}

function EmptyState({
  title,
  body,
  dark = false,
}: {
  title: string;
  body: string;
  dark?: boolean;
}) {
  return (
    <div
      className={
        dark
          ? "rounded-2xl border border-dashed border-white/30 bg-white/10 p-5"
          : "rounded-2xl border border-dashed border-border bg-muted/25 p-5"
      }
    >
      <p className="font-semibold">{title}</p>
      <p className={dark ? "mt-1 text-sm text-primary-foreground/70" : "mt-1 text-sm text-muted-foreground"}>
        {body}
      </p>
    </div>
  );
}

function ReminderSkeleton({ dark = false }: { dark?: boolean }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className={
            dark
              ? "rounded-2xl border border-white/15 bg-white/10 p-4"
              : "rounded-2xl border border-border/60 bg-muted/20 p-4"
          }
        >
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-3 h-4 w-52 max-w-full" />
        </div>
      ))}
    </div>
  );
}

function RoomSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4" aria-busy="true">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-4 h-4 w-40" />
      <Skeleton className="mt-5 h-5 w-24" />
    </div>
  );
}

function ChartLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`size-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function RoomBadge({ status }: { status: RoomUiStatus }) {
  const variant =
    status === "available"
      ? "success"
      : status === "maintenance"
        ? "warning"
        : "secondary";

  return <Badge variant={variant}>{roomStatusLabel[status]}</Badge>;
}

function InvoiceBadge({
  status,
}: {
  status: DashboardUnpaidInvoice["status"];
}) {
  const variant =
    status === "Paid"
      ? "success"
      : status === "Partially Paid"
        ? "warning"
        : "destructive";

  return <Badge variant={variant}>{invoiceStatusLabel[status]}</Badge>;
}

function periodSearchParams(period: BillingPeriod) {
  return new URLSearchParams({
    month: String(period.month),
    year: String(period.year),
  }).toString();
}

function revenueSearchParams(
  period: BillingPeriod,
  chartRange: DashboardRevenueRange,
) {
  return new URLSearchParams({
    month: String(period.month),
    year: String(period.year),
    range: chartRange,
  }).toString();
}
