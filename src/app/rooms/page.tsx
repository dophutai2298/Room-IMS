import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readRoomsOverview } from "@/lib/insforge/rental-repository";
import {
  roomStatusLabel,
  type RoomListItem,
  type RoomUiStatus,
} from "@/lib/rooms/presenter";

export default async function RoomsPage() {
  const result = await readRoomsOverview();

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Quản lý phòng</p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Danh sách phòng trọ
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Dữ liệu phòng, Tenant và active Contract đang đọc trực tiếp từ InsForge.
            Trạng thái phòng được tính từ Contract, trừ khi phòng đang bảo trì.
          </p>
        </div>
        <Button disabled title="Ticket sau sẽ thêm form tạo phòng">
          Thêm phòng mới
        </Button>
      </header>

      {result.error ? (
        <ErrorCard
          title="Không tải được danh sách phòng"
          message={result.error.message}
        />
      ) : result.data.length === 0 ? (
        <EmptyRooms />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result.data.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </section>
      )}
    </>
  );
}

function RoomCard({ room }: { room: RoomListItem }) {
  return (
    <Link href={`/rooms/${room.id}`} className="group">
      <Card className="h-full group-hover:-translate-y-1 group-hover:border-primary/30 group-hover:bg-card">
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{room.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {room.keyTenantName ?? "Chưa có Key Tenant"}
              </p>
            </div>
            <RoomBadge status={room.status} />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/40 bg-background/35 p-4 clay-inset dark:border-white/8">
            <InfoBlock label="Giá thuê" value={formatCurrency(room.basePrice)} />
            <InfoBlock label="Số người ở" value={`${room.tenantCount} người`} />
          </div>

          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Việc tiếp theo</span>
            <span className="text-right font-medium">{room.nextAction}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyRooms() {
  return (
    <Card>
      <CardContent className="rounded-[1.5rem] border border-dashed border-border bg-muted/25 p-8 text-center">
        <p className="text-lg font-semibold">Chưa có phòng nào</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Khi Rooms được seed hoặc tạo mới trong InsForge, danh sách sẽ xuất hiện
          tại đây sau khi refresh.
        </p>
      </CardContent>
    </Card>
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

function InfoBlock({ label, value }: { label: string; value: string }) {
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}
