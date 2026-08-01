import Link from "next/link";
import { notFound } from "next/navigation";

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
  formatCurrency,
  rooms,
  roomStatusLabel,
  tenants,
  type RoomStatus,
} from "@/lib/demo-data";

export default async function RoomDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const room = rooms.find((item) => item.id === id);

  if (!room) {
    notFound();
  }

  const roomTenants = tenants.filter((tenant) => tenant.roomId === room.id);

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/rooms">← Quay lại danh sách phòng</Link>
          </Button>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Chi tiết {room.name}
            </h1>
            <RoomBadge status={room.status} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Mock detail cho Tenant, Key Tenant và Contract trước khi chuyển sang
            InsForge.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="secondary">
            <Link href={`/rooms/${room.id}/utilities`}>Chốt điện nước</Link>
          </Button>
          <Button>Thêm Tenant</Button>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Danh sách Tenant</CardTitle>
            <CardDescription>
              Dữ liệu mẫu cho phòng {room.id}. Ticket 03 sẽ thay bằng persisted
              data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {roomTenants.length > 0 ? (
              roomTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="rounded-2xl border border-white/45 bg-background/35 p-4 clay-inset dark:border-white/8"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{tenant.name}</p>
                        {tenant.role === "Key Tenant" && (
                          <Badge variant="default">Key Tenant</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {tenant.phone}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Xem CCCD
                    </Button>
                  </div>
                  <Separator className="my-4" />
                  <p className="text-sm text-muted-foreground">
                    {tenant.identityStatus}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6">
                <p className="font-medium">Chưa có Tenant</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sau khi nối InsForge, phòng trống sẽ hiển thị empty state này.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin Contract</CardTitle>
            <CardDescription>Mock contract đang hiệu lực.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailRow label="Trạng thái" value="Hiệu lực" />
            <DetailRow label="Giá thuê" value={`${formatCurrency(room.rent)} / tháng`} />
            <DetailRow label="Tiền cọc" value={formatCurrency(room.rent)} />
            <DetailRow label="Key Tenant" value={room.keyTenant ?? "Chưa có"} />
            <DetailRow label="Ngày bắt đầu" value="01/08/2026" />
            <DetailRow label="Ngày kết thúc" value="01/08/2027" />
          </CardContent>
        </Card>
      </section>
    </>
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

function RoomBadge({ status }: { status: RoomStatus }) {
  const variant =
    status === "available"
      ? "success"
      : status === "maintenance"
        ? "warning"
        : "secondary";

  return <Badge variant={variant}>{roomStatusLabel[status]}</Badge>;
}
