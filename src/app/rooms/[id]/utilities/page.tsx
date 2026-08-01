import Link from "next/link";
import { notFound } from "next/navigation";

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
import {
  formatCurrency,
  rooms,
  utilityReadings,
} from "@/lib/demo-data";

export default async function UtilitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const room = rooms.find((item) => item.id === id);

  if (!room) {
    notFound();
  }

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href={`/rooms/${room.id}`}>← Quay lại chi tiết phòng</Link>
          </Button>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Chốt điện nước tháng 8/2026
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {room.name} · {room.keyTenant ?? "Chưa có Key Tenant"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <p className="font-medium">Kỳ ghi chỉ số</p>
          <p className="mt-1 text-muted-foreground">{utilityReadings.period}</p>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="grid gap-4 lg:grid-cols-2">
          <MetricFormCard
            title="Chỉ số điện"
            unit={utilityReadings.electricity.unit}
            previous={utilityReadings.electricity.previous}
            price={utilityReadings.electricity.price}
            inputId="electricity-current"
            placeholder="Nhập chỉ số điện mới"
          />
          <MetricFormCard
            title="Chỉ số nước"
            unit={utilityReadings.water.unit}
            previous={utilityReadings.water.previous}
            price={utilityReadings.water.price}
            inputId="water-current"
            placeholder="Nhập chỉ số nước mới"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Trạng thái UI</CardTitle>
            <CardDescription>
              Các pattern dùng lại cho ticket real-data sau.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">Loading skeleton</p>
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Separator />
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Nếu chỉ số mới thấp hơn chỉ số cũ, form sẽ hiển thị lỗi inline ở
              ticket 04.
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button asChild variant="secondary">
          <Link href={`/rooms/${room.id}`}>Hủy bỏ</Link>
        </Button>
        <Button>Lưu và tính hóa đơn</Button>
      </div>
    </>
  );
}

function MetricFormCard({
  title,
  unit,
  previous,
  price,
  inputId,
  placeholder,
}: {
  title: string;
  unit: string;
  previous: number;
  price: number;
  inputId: string;
  placeholder: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Đơn giá mẫu: {formatCurrency(price)} / {unit}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`${inputId}-previous`}>Chỉ số cũ</Label>
            <Input id={`${inputId}-previous`} value={previous} disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={inputId}>Chỉ số mới</Label>
            <Input id={inputId} placeholder={placeholder} type="number" />
            <p className="text-xs text-muted-foreground">
              Giá trị mới phải lớn hơn hoặc bằng chỉ số cũ.
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">Lượng tiêu thụ</p>
          <p className="mt-1 font-mono text-2xl font-semibold">0 {unit}</p>
        </div>
      </CardContent>
    </Card>
  );
}
