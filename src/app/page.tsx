import Link from "next/link";

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
  invoices,
  invoiceStatusLabel,
  rooms,
  roomStatusLabel,
} from "@/lib/demo-data";

const paidRevenue = invoices
  .filter((invoice) => invoice.status === "paid")
  .reduce((sum, invoice) => sum + invoice.total, 0);

const outstandingDebt = invoices
  .filter((invoice) => invoice.status !== "paid")
  .reduce((sum, invoice) => sum + invoice.total, 0);

const availableRooms = rooms.filter((room) => room.status === "available").length;
const missingUtilityRooms = rooms.filter((room) =>
  room.nextAction.toLowerCase().includes("thiếu"),
);

export default function Dashboard() {
  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Bảng điều hành tháng 8/2026
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Tổng quan vận hành
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Mock data cho UI foundation. Ticket 02 sẽ nối InsForge và seed data
            thật cho cùng luồng này.
          </p>
        </div>
        <Button asChild>
          <Link href="/rooms">Xem danh sách phòng</Link>
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Doanh thu đã thu"
          value={formatCurrency(paidRevenue)}
          note="Dựa trên hóa đơn mock đã thanh toán"
        />
        <MetricCard
          label="Công nợ còn lại"
          value={formatCurrency(outstandingDebt)}
          note="Gồm chưa thanh toán và một phần"
          tone="warning"
        />
        <MetricCard
          label="Phòng còn trống"
          value={`${availableRooms} / ${rooms.length}`}
          note="Room Status được hiển thị từ mock data"
          tone="success"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nhắc việc tháng này</CardTitle>
            <CardDescription>
              Các trạng thái mẫu để kiểm tra loading, empty và action states ở
              ticket sau.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {missingUtilityRooms.length > 0 ? (
              missingUtilityRooms.map((room) => (
                <div
                  key={room.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{room.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {room.nextAction}
                    </p>
                  </div>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/rooms/${room.id}/utilities`}>Nhập chỉ số</Link>
                  </Button>
                </div>
              ))
            ) : (
              <EmptyState title="Không có nhắc việc" body="Tất cả phòng đã đủ dữ liệu cho kỳ hiện tại." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hóa đơn cần thu</CardTitle>
            <CardDescription>Danh sách ngắn dùng mock data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {invoices
              .filter((invoice) => invoice.status !== "paid")
              .map((invoice) => (
                <div key={invoice.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{invoice.room}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.id} · {invoice.period}
                      </p>
                    </div>
                    <InvoiceBadge status={invoice.status} />
                  </div>
                  <div className="font-mono text-lg font-semibold">
                    {formatCurrency(invoice.total)}
                  </div>
                  <Separator />
                </div>
              ))}
            <Button asChild variant="outline" className="w-full">
              <Link href="/invoices">Mở danh sách hóa đơn</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Trạng thái phòng</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rooms.map((room) => (
            <Card key={room.id} className="shadow-none">
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{room.name}</p>
                  <RoomBadge status={room.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {room.keyTenant ?? "Chưa có Key Tenant"}
                </p>
                <p className="font-mono text-sm">{formatCurrency(room.rent)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "default" | "warning" | "success";
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p
          className={
            tone === "warning"
              ? "font-mono text-2xl font-semibold text-amber-700 dark:text-amber-300"
              : tone === "success"
                ? "font-mono text-2xl font-semibold text-emerald-700 dark:text-emerald-300"
                : "font-mono text-2xl font-semibold"
          }
        >
          {value}
        </p>
        <p className="text-sm text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function RoomBadge({ status }: { status: (typeof rooms)[number]["status"] }) {
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
  status: (typeof invoices)[number]["status"];
}) {
  const variant =
    status === "paid" ? "success" : status === "partial" ? "warning" : "destructive";

  return <Badge variant={variant}>{invoiceStatusLabel[status]}</Badge>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
