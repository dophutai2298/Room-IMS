import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { readInvoicesOverview } from "@/lib/insforge/rental-repository";
import {
  invoiceStatusLabel,
  type InvoiceListItem,
} from "@/lib/invoices/presenter";
import type { InvoiceRecord } from "@/lib/insforge/types";
import { formatCurrency } from "@/lib/formatters";

export default async function InvoicesPage() {
  const result = await readInvoicesOverview();
console.log("results::: ",result)
  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Thu tien phong</p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
           Hóa đơn & Thu tiền
          </h1>
          {/* <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Hoa don duoc doc truc tiep tu InsForge. Ticket 05 tao hoa don tu
            Utility Metrics va hien thi tai danh sach nay sau khi refresh.
          </p> */}
        </div>
        <Button asChild variant="secondary">
          <Link href="/rooms">Chọn phòng để tạo hóa đơn</Link>
        </Button>
      </header>

      {result.error ? (
        <ErrorCard
          title="Khong tai duoc danh sach hoa don"
          message={result.error.message}
        />
      ) : result.data.length === 0 ? (
        <EmptyInvoices />
      ) : (
        <InvoiceTable invoices={result.data} />
      )}
    </>
  );
}

function InvoiceTable({ invoices }: { invoices: InvoiceListItem[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Danh sách hóa đơn</CardTitle>
        {/* <CardDescription>
          Moi dong la mot invoice duy nhat theo Room va ky thu.
        </CardDescription> */}
      </CardHeader>
      <CardContent className="pt-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã HD</TableHead>
              <TableHead>Kỳ thu</TableHead>
              <TableHead>Phòng</TableHead>
              <TableHead>Tiền thuê</TableHead>
              <TableHead>Điện</TableHead>
              <TableHead>Nước</TableHead>
              <TableHead>Phí khác</TableHead>
              <TableHead>Tổng tiền</TableHead>
              <TableHead>Đã thu</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-mono text-xs tabular-nums">
                  {invoice.shortId}
                </TableCell>
                <TableCell>{invoice.periodLabel}</TableCell>
                <TableCell className="font-medium">{invoice.roomName}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatCurrency(invoice.roomFee)}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatCurrency(invoice.electricityFee)}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatCurrency(invoice.waterFee)}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatCurrency(invoice.otherFee)}
                </TableCell>
                <TableCell className="font-mono font-semibold tabular-nums">
                  {formatCurrency(invoice.totalAmount)}
                </TableCell>
                <TableCell className="font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(invoice.amountPaid)}
                </TableCell>
                <TableCell>
                  <InvoiceBadge status={invoice.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/rooms/${invoice.roomId}/utilities?month=${invoice.billingPeriod.month}&year=${invoice.billingPeriod.year}`}
                    >
                      Xem chi tiết
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EmptyInvoices() {
  return (
    <Card>
      <CardContent className="rounded-[1.5rem] border border-dashed border-border bg-muted/25 p-8 text-center">
        <p className="text-lg font-semibold">Chua co hoa don nao</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Sau khi tao hoa don tu man hinh chot dien nuoc, invoice se xuat hien
          o day.
        </p>
      </CardContent>
    </Card>
  );
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <Card className="border-destructive/20">
      <CardContent className="space-y-2">
        <Badge variant="destructive">Loi InsForge</Badge>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

function InvoiceBadge({ status }: { status: InvoiceRecord["status"] }) {
  const variant =
    status === "Paid"
      ? "success"
      : status === "Partially Paid"
        ? "warning"
        : "destructive";

  return <Badge variant={variant}>{invoiceStatusLabel[status]}</Badge>;
}
