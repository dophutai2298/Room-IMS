import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatCurrency,
  rooms,
  roomStatusLabel,
  type RoomStatus,
} from "@/lib/demo-data";

export default function RoomsPage() {
  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">
            Quản lý phòng
          </p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Danh sách phòng trọ
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Màn hình dùng mock data để kiểm tra card, badge và trạng thái rỗng
            trước khi nối InsForge.
          </p>
        </div>
        <Button>Thêm phòng mới</Button>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rooms.map((room) => (
          <Link key={room.id} href={`/rooms/${room.id}`} className="group">
            <Card className="h-full group-hover:-translate-y-1 group-hover:border-primary/30 group-hover:bg-card">
              <CardContent className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{room.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {room.keyTenant ?? "Chưa có người thuê"}
                    </p>
                  </div>
                  <RoomBadge status={room.status} />
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/40 bg-background/35 p-4 clay-inset dark:border-white/8">
                  <InfoBlock label="Giá thuê" value={formatCurrency(room.rent)} />
                  <InfoBlock label="Số người ở" value={`${room.tenants} người`} />
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Việc tiếp theo</span>
                  <span className="text-right font-medium">{room.nextAction}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </>
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

function RoomBadge({ status }: { status: RoomStatus }) {
  const variant =
    status === "available"
      ? "success"
      : status === "maintenance"
        ? "warning"
        : "secondary";

  return <Badge variant={variant}>{roomStatusLabel[status]}</Badge>;
}
