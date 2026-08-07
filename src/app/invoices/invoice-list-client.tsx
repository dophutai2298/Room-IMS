"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchAppApi } from "@/lib/api/client";
import { formatCurrency } from "@/lib/formatters";
import type { InvoiceRecord } from "@/lib/insforge/types";
import {
  invoiceStatusLabel,
  type InvoiceListItem,
} from "@/lib/invoices/presenter";
import { invoiceQueryKeys } from "@/lib/invoices/query-keys";

export function InvoiceListClient() {
  const invoicesQuery = useQuery({
    queryKey: invoiceQueryKeys.list(),
    queryFn: () =>
      fetchAppApi<InvoiceListItem[]>("/api/invoices", {
        cache: "no-store",
      }),
  });

  if (invoicesQuery.isPending) {
    return <InvoiceTableSkeleton />;
  }

  if (invoicesQuery.isError) {
    return (
      <ErrorCard
        message={invoicesQuery.error.message}
        onRetry={() => void invoicesQuery.refetch()}
      />
    );
  }

  if (invoicesQuery.data.length === 0) {
    return <EmptyInvoices onRetry={() => void invoicesQuery.refetch()} />;
  }

  return <InvoiceTable invoices={invoicesQuery.data} />;
}

function InvoiceTable({ invoices }: { invoices: InvoiceListItem[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Danh sách hóa đơn</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã HĐ</TableHead>
              <TableHead>Kỳ thu</TableHead>
              <TableHead>Phòng</TableHead>
              <TableHead>Tiền thuê</TableHead>
              <TableHead>Điện</TableHead>
              <TableHead>Nước</TableHead>
              <TableHead>Phí khác</TableHead>
              <TableHead>Tổng tiền</TableHead>
              <TableHead>Đã thu</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
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
                      Xem chi tiết
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

function InvoiceTableSkeleton() {
  return (
    <Card className="overflow-hidden" aria-busy="true" aria-live="polite">
      <CardHeader>
        <CardTitle>Danh sách hóa đơn</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-2 gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 md:grid-cols-6"
          >
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyInvoices({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="rounded-[1.5rem] border border-dashed border-border bg-muted/25 p-8 text-center">
        <p className="text-lg font-semibold">Chưa có hóa đơn nào</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Sau khi tạo hóa đơn từ màn hình chốt điện nước, invoice sẽ xuất hiện ở đây.
        </p>
        <Button className="mt-5" variant="secondary" onClick={onRetry}>
          Tải lại
        </Button>
      </CardContent>
    </Card>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-destructive/20">
      <CardContent className="space-y-3">
        <Badge variant="destructive">Lỗi API</Badge>
        <h2 className="text-lg font-semibold">Không tải được danh sách hóa đơn</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="secondary" onClick={onRetry}>
          Thử lại
        </Button>
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
