import Link from "next/link";

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
  formatCurrency,
  invoices,
  invoiceStatusLabel,
  rooms,
  roomStatusLabel,
} from "@/lib/demo-data";

const paidRevenue = invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);

const outstandingDebt = invoices.reduce(
  (sum, invoice) => sum + invoice.total - invoice.amountPaid,
  0,
);

const availableRooms = rooms.filter((room) => room.status === "available").length;
const occupiedRooms = rooms.filter((room) => room.status === "occupied").length;
const occupancyRate = Math.round((occupiedRooms / rooms.length) * 100);
const missingUtilityRooms = rooms.filter((room) =>
  room.nextAction.toLowerCase().includes("thiếu"),
);

export default function Dashboard() {
  return (
    <>
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-primary">Tháng 8/2026</p>
            <span className="size-1 rounded-full bg-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Dữ liệu minh họa</p>
          </div>
          <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            Mọi việc cần làm, nhìn trong một màn hình.
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
            Theo dõi doanh thu, công nợ và tình trạng phòng trước khi dữ liệu thật
            được kết nối với InsForge ở ticket 02.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/rooms">Quản lý phòng <span aria-hidden="true">→</span></Link>
        </Button>
      </header>

      <section aria-label="Chỉ số vận hành" className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        <MetricCard
          className="xl:col-span-4"
          icon="↗"
          label="Doanh thu đã thu"
          value={formatCurrency(paidRevenue)}
          note="Hóa đơn mock đã thanh toán"
          trend="+8,4% so với tháng 7"
        />
        <MetricCard
          className="xl:col-span-3"
          icon="◎"
          label="Công nợ"
          value={formatCurrency(outstandingDebt)}
          note="Chưa thu và thu một phần"
          tone="warning"
        />
        <MetricCard
          className="xl:col-span-3"
          icon="▦"
          label="Tỷ lệ lấp đầy"
          value={`${occupancyRate}%`}
          note={`${occupiedRooms} trên ${rooms.length} phòng đang thuê`}
          tone="success"
        />
        <MetricCard
          className="md:col-span-2 xl:col-span-2"
          icon="○"
          label="Phòng trống"
          value={`${availableRooms}`}
          note="Có thể cho thuê"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.65fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Dòng tiền 6 tháng</CardTitle>
              <CardDescription className="mt-1.5">
                So sánh số đã lập hóa đơn và thực thu theo tháng.
              </CardDescription>
            </div>
            <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
              <ChartLegend color="bg-chart-primary" label="Đã thu" />
              <ChartLegend color="bg-chart-secondary" label="Đã lập HĐ" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <RevenueChart />
          </CardContent>
        </Card>

        <Card className="bg-primary text-primary-foreground dark:bg-primary/90">
          <CardHeader>
            <p className="text-sm font-medium text-primary-foreground/70">Ưu tiên hôm nay</p>
            <CardTitle className="text-2xl">Chốt đủ chỉ số trước ngày 28</CardTitle>
            <CardDescription className="text-primary-foreground/70">
              Còn {missingUtilityRooms.length} phòng thiếu dữ liệu cho kỳ hiện tại.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {missingUtilityRooms.map((room) => (
              <div
                key={room.id}
                className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{room.name}</p>
                    <p className="mt-1 text-sm text-primary-foreground/70">{room.nextAction}</p>
                  </div>
                  <span aria-hidden="true" className="text-xl">↗</span>
                </div>
                <Button asChild size="sm" variant="secondary" className="mt-4 w-full">
                  <Link href={`/rooms/${room.id}/utilities`}>Nhập chỉ số</Link>
                </Button>
              </div>
            ))}
            {missingUtilityRooms.length === 0 && (
              <EmptyState
                title="Không có nhắc việc"
                body="Tất cả phòng đã đủ dữ liệu cho kỳ hiện tại."
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Hóa đơn cần thu</CardTitle>
              <CardDescription className="mt-1.5">Ưu tiên theo trạng thái thanh toán.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/invoices">Xem tất cả</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {invoices
              .filter((invoice) => invoice.status !== "paid")
              .map((invoice) => (
                <div key={invoice.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{invoice.room}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {invoice.id} · {invoice.period}
                      </p>
                    </div>
                    <InvoiceBadge status={invoice.status} />
                  </div>
                  <div className="font-mono text-xl font-semibold tabular-nums">
                    {formatCurrency(invoice.total)}
                  </div>
                  <Separator />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nhịp vận hành các phòng</CardTitle>
            <CardDescription>
              Trạng thái hiện tại và đầu việc gần nhất của từng phòng.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="group rounded-2xl border border-white/50 bg-background/35 p-4 clay-inset outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring dark:border-white/8"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{room.name}</p>
                  <RoomBadge status={room.status} />
                </div>
                <p className="mt-3 line-clamp-1 text-sm text-muted-foreground">
                  {room.keyTenant ?? "Chưa có Key Tenant"}
                </p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <p className="font-mono text-sm font-semibold tabular-nums">
                    {formatCurrency(room.rent)}
                  </p>
                  <span aria-hidden="true" className="text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function MetricCard({
  className,
  icon,
  label,
  value,
  note,
  trend,
  tone = "default",
}: {
  className?: string;
  icon: string;
  label: string;
  value: string;
  note: string;
  trend?: string;
  tone?: "default" | "warning" | "success";
}) {
  return (
    <Card className={className}>
      <CardContent className="flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent/70 text-lg font-semibold text-accent-foreground clay-inset">
            {icon}
          </span>
        </div>
        <div className="mt-auto">
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
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{note}</span>
            {trend && <Badge variant="success">{trend}</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
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
    <div className="rounded-2xl border border-dashed border-white/30 bg-white/10 p-5">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-primary-foreground/70">{body}</p>
    </div>
  );
}
