import Link from "next/link";
import { notFound } from "next/navigation";

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
import { readRoomDetail } from "@/lib/insforge/rental-repository";
import {
  roomStatusLabel,
  type RoomDetailView,
  type RoomUiStatus,
  type TenantView,
} from "@/lib/rooms/presenter";

export default async function RoomDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await readRoomDetail(id);

  if (result.error?.statusCode === 404) {
    notFound();
  }

  if (result.error) {
    return (
      <ErrorCard
        title="Không tải được chi tiết phòng"
        message={result.error.message}
      />
    );
  }

  const detail = result.data;

  return (
    <>
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
            Tenant và active Contract được đọc từ InsForge. Key Tenant lấy theo
            quan hệ active Contract, không còn dựa vào mock data.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="secondary">
            <Link href={`/rooms/${detail.room.id}/utilities`}>Chốt điện nước</Link>
          </Button>
          <Button disabled title="Ticket sau sẽ thêm form tạo Tenant">
            Thêm Tenant
          </Button>
        </div>
      </header>

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
    </>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <Card className="border-destructive/20">
      <CardContent className="space-y-2">
        <Badge variant="destructive">Lỗi InsForge</Badge>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}
