"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { KeyTenantForm } from "./key-tenant-form";
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
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAppApi } from "@/lib/api/client";
import { formatCurrency } from "@/lib/formatters";
import { invoiceStatusLabel } from "@/lib/invoices/presenter";
import {
  roomStatusLabel,
  type RoomDetailView,
  type RoomOperationsSummaryView,
  type RoomUiStatus,
  type TenantView,
} from "@/lib/rooms/presenter";
import { roomQueryKeys } from "@/lib/rooms/query-keys";

export function RoomDetailClient({ roomId }: { roomId: string }) {
  const detailQuery = useQuery({
    queryKey: roomQueryKeys.detail(roomId),
    queryFn: () =>
      fetchAppApi<RoomDetailView>(`/api/rooms/${roomId}/detail`, {
        cache: "no-store",
      }),
  });
  const summaryQuery = useQuery({
    queryKey: roomQueryKeys.operationsSummary(roomId),
    queryFn: () =>
      fetchAppApi<RoomOperationsSummaryView>(
        `/api/rooms/${roomId}/operations-summary`,
        {
          cache: "no-store",
        },
      ),
  });

  if (detailQuery.isPending) {
    return <RoomDetailSkeleton />;
  }

  if (detailQuery.isError) {
    return (
      <ErrorCard
        title="Không tải được chi tiết phòng"
        message={detailQuery.error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const detail = detailQuery.data;

  return (
    <>
      <RoomHeader detail={detail} />

      {detail.integrityWarning && (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge variant="warning">Cần kiểm tra Contract</Badge>
              <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">
                {detail.integrityWarning}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <TenantsCard detail={detail} />
        <ContractCard detail={detail} />
      </section>

      <OperationsSummarySection
        summaryQuery={{
          data: summaryQuery.data,
          isPending: summaryQuery.isPending,
          isError: summaryQuery.isError,
          errorMessage: summaryQuery.error?.message,
          refetch: () => void summaryQuery.refetch(),
        }}
      />
    </>
  );
}

function RoomHeader({ detail }: { detail: RoomDetailView }) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/rooms">← Quay lại danh sách phòng</Link>
        </Button>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Chi tiết {detail.room.name}
          </h1>
          <RoomBadge status={detail.room.status} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Tenant, active Contract, chỉ số điện nước và hóa đơn được tải qua API
          nội bộ đã xác thực.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="secondary">
          <Link href={`/rooms/${detail.room.id}/utilities`}>
            Chốt điện nước
          </Link>
        </Button>
        <Button disabled title="Ticket sau sẽ thêm form tạo Tenant">
          Thêm Tenant
        </Button>
      </div>
    </header>
  );
}

function TenantsCard({ detail }: { detail: RoomDetailView }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Danh sách Tenant</CardTitle>
        <CardDescription>
          Persisted Tenants đang gắn với {detail.room.name}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {detail.tenants.length > 0 ? (
          detail.tenants.map((tenant) => (
            <TenantCard key={tenant.id} tenant={tenant} />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6">
            <p className="font-medium">Chưa có Tenant</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Phòng này chưa có Tenant persisted trong InsForge.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TenantCard({ tenant }: { tenant: TenantView }) {
  return (
    <div className="rounded-2xl border border-white/45 bg-background/35 p-4 clay-inset dark:border-white/8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{tenant.name}</p>
            {tenant.isKeyTenant && <Badge variant="default">Key Tenant</Badge>}
            {tenant.status === "Moved Out" && (
              <Badge variant="outline">Đã chuyển đi</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {tenant.phone ?? "Chưa có số điện thoại"}
          </p>
        </div>
        <Button variant="outline" size="sm" disabled>
          Xem CCCD
        </Button>
      </div>
      <Separator className="my-4" />
      <p className="text-sm text-muted-foreground">
        Vai trò Key Tenant được xác định bằng active Contract của phòng.
      </p>
    </div>
  );
}

function ContractCard({ detail }: { detail: RoomDetailView }) {
  const contract = detail.activeContract;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin Contract</CardTitle>
        <CardDescription>
          Active Contract quyết định trạng thái thuê của phòng.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {contract ? (
          <>
            <div className="space-y-4">
              <DetailRow label="Trạng thái" value="Hiệu lực" />
              <DetailRow
                label="Giá thuê"
                value={`${formatCurrency(contract.rentAmount)} / tháng`}
              />
              <DetailRow
                label="Tiền cọc"
                value={formatCurrency(contract.depositAmount)}
              />
              <DetailRow
                label="Key Tenant"
                value={detail.keyTenantName ?? "Chưa có"}
              />
              <DetailRow
                label="Ngày bắt đầu"
                value={formatDate(contract.startDate)}
              />
              <DetailRow
                label="Ngày kết thúc"
                value={contract.endDate ? formatDate(contract.endDate) : "Không có"}
              />
            </div>
            <Separator />
            <KeyTenantForm
              roomId={detail.room.id}
              tenants={detail.tenants}
              activeContractId={contract.id}
              currentKeyTenantId={contract.keyTenantId}
            />
          </>
        ) : (
          <>
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6">
              <p className="font-medium">Chưa có active Contract</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Nếu phòng không ở trạng thái bảo trì, trạng thái sẽ được tính là
                Trống cho tới khi có Contract hiệu lực.
              </p>
            </div>
            <KeyTenantForm
              roomId={detail.room.id}
              tenants={detail.tenants}
              activeContractId={null}
              currentKeyTenantId={null}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OperationsSummarySection({
  summaryQuery,
}: {
  summaryQuery: {
    data: RoomOperationsSummaryView | undefined;
    isPending: boolean;
    isError: boolean;
    errorMessage?: string;
    refetch: () => void;
  };
}) {
  if (summaryQuery.isPending) {
    return (
      <section className="grid gap-4 xl:grid-cols-2">
        <SummarySkeleton title="Tổng quan điện nước" />
        <SummarySkeleton title="Tổng quan hóa đơn" />
      </section>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <ErrorCard
        title="Không tải được tổng quan vận hành"
        message={summaryQuery.errorMessage ?? "Vui lòng thử tải lại."}
        onRetry={summaryQuery.refetch}
      />
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <UtilitySummaryCard summary={summaryQuery.data.utilityMetrics} />
      <InvoiceSummaryCard summary={summaryQuery.data.invoices} />
    </section>
  );
}

function UtilitySummaryCard({
  summary,
}: {
  summary: RoomOperationsSummaryView["utilityMetrics"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tổng quan điện nước</CardTitle>
        <CardDescription>
          Kỳ chốt chỉ số gần nhất và mức tiêu thụ đã persisted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DetailRow
          label="Số kỳ đã chốt"
          value={`${summary.metricCount} kỳ`}
        />
        <DetailRow
          label="Kỳ gần nhất"
          value={summary.latestPeriodLabel ?? "Chưa có"}
        />
        <DetailRow
          label="Chỉ số điện mới nhất"
          value={
            summary.latestElectricityReading === null
              ? "Chưa có"
              : `${summary.latestElectricityReading} kWh`
          }
        />
        <DetailRow
          label="Tiêu thụ điện kỳ gần nhất"
          value={
            summary.latestElectricityConsumption === null
              ? "Chưa có"
              : `${summary.latestElectricityConsumption} kWh`
          }
        />
        <DetailRow
          label="Chỉ số nước mới nhất"
          value={
            summary.latestWaterReading === null
              ? "Chưa có"
              : `${summary.latestWaterReading} m³`
          }
        />
        <DetailRow
          label="Tiêu thụ nước kỳ gần nhất"
          value={
            summary.latestWaterConsumption === null
              ? "Chưa có"
              : `${summary.latestWaterConsumption} m³`
          }
        />
      </CardContent>
    </Card>
  );
}

function InvoiceSummaryCard({
  summary,
}: {
  summary: RoomOperationsSummaryView["invoices"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tổng quan hóa đơn</CardTitle>
        <CardDescription>
          Tình trạng hóa đơn của phòng theo dữ liệu persisted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DetailRow label="Số hóa đơn" value={`${summary.invoiceCount} hóa đơn`} />
        <DetailRow label="Chưa thanh toán" value={`${summary.unpaidCount} hóa đơn`} />
        <DetailRow
          label="Công nợ còn lại"
          value={formatCurrency(summary.totalBalanceDue)}
        />
        {summary.latestInvoice ? (
          <>
            <Separator />
            <DetailRow
              label="Kỳ gần nhất"
              value={summary.latestInvoice.periodLabel}
            />
            <DetailRow
              label="Trạng thái"
              value={invoiceStatusLabel[summary.latestInvoice.status]}
            />
            <DetailRow
              label="Tổng tiền"
              value={formatCurrency(summary.latestInvoice.totalAmount)}
            />
            <DetailRow
              label="Đã thu"
              value={formatCurrency(summary.latestInvoice.amountPaid)}
            />
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6">
            <p className="font-medium">Chưa có hóa đơn</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sau khi tạo hóa đơn từ Utility Metrics, tổng quan sẽ hiển thị tại đây.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RoomDetailSkeleton() {
  return (
    <>
      <header className="space-y-3">
        <Skeleton className="h-8 w-44" />
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-12 w-80 max-w-full" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
        <Skeleton className="h-5 w-[36rem] max-w-full" />
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SummarySkeleton title="Danh sách Tenant" />
        <SummarySkeleton title="Thông tin Contract" />
      </section>
    </>
  );
}

function SummarySkeleton({ title }: { title: string }) {
  return (
    <Card aria-busy="true" aria-live="polite">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Skeleton className="h-4 w-72 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
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

function RoomBadge({ status }: { status: RoomUiStatus }) {
  const variant =
    status === "available"
      ? "success"
      : status === "maintenance"
        ? "warning"
        : "secondary";

  return <Badge variant={variant}>{roomStatusLabel[status]}</Badge>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}
