"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppApiClientError, fetchAppApi } from "@/lib/api/client";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { formatCurrency } from "@/lib/formatters";
import {
  type InvoicePaymentStatus,
  invoiceStatusLabel,
  type InvoiceListItem,
} from "@/lib/invoices/presenter";
import { invoiceQueryKeys } from "@/lib/invoices/query-keys";
import { roomQueryKeys } from "@/lib/rooms/query-keys";

const paymentStatusOptions: Array<{
  value: InvoicePaymentStatus;
  label: string;
  description: string;
}> = [
  {
    value: "Unpaid",
    label: invoiceStatusLabel.Unpaid,
    description: "Tự đặt đã thu về 0.",
  },
  {
    value: "Partially Paid",
    label: invoiceStatusLabel["Partially Paid"],
    description: "Cần nhập số tiền đã thu, nhỏ hơn tổng hóa đơn.",
  },
  {
    value: "Paid",
    label: invoiceStatusLabel.Paid,
    description: "Tự đặt đã thu bằng tổng hóa đơn.",
  },
];

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
  const currentPeriod = useMemo(() => getCurrentBillingPeriodOption(), []);
  const periodOptions = useMemo(
    () => buildPeriodOptions({ invoices, currentPeriod }),
    [currentPeriod, invoices],
  );
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);
  const activePeriodKey = selectedPeriodKey ?? currentPeriod.key;
  const filteredInvoices =
    activePeriodKey === "all"
      ? invoices
      : invoices.filter(
          (invoice) => getBillingPeriodKey(invoice) === activePeriodKey,
        );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle>Danh sách hóa đơn</CardTitle>
        <div className="w-full md:w-56">
          <Select value={activePeriodKey} onValueChange={setSelectedPeriodKey}>
            <SelectTrigger aria-label="Lọc kỳ thu">
              <SelectValue placeholder="Chọn kỳ thu" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((period) => (
                <SelectItem key={period.key} value={period.key}>
                  {period.label}
                </SelectItem>
              ))}
              <SelectItem value="all">Tất cả kỳ</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-2">
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
              <TableHead>Còn lại</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.map((invoice) => (
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
                <TableCell className="font-mono tabular-nums text-amber-700 dark:text-amber-300">
                  {formatCurrency(invoice.balanceDue)}
                </TableCell>
                <TableCell>
                  <InvoiceBadge status={invoice.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <RecordPaymentDialog invoice={invoice} />
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/rooms/${invoice.roomId}/utilities?month=${invoice.billingPeriod.month}&year=${invoice.billingPeriod.year}`}
                      >
                        Xem chi tiết
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredInvoices.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={12}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Không có hóa đơn trong kỳ đã chọn.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RecordPaymentDialog({ invoice }: { invoice: InvoiceListItem }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<InvoicePaymentStatus>(invoice.status);
  const [amountPaidInput, setAmountPaidInput] = useState(
    invoice.status === "Partially Paid" ? String(invoice.amountPaid) : "",
  );
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const parsedAmountPaid = parseMoneyInput(amountPaidInput);
  const clientValidationMessage = useMemo(
    () =>
      validatePaymentDraft({
        status,
        amountPaid: parsedAmountPaid,
        totalAmount: invoice.totalAmount,
      }),
    [invoice.totalAmount, parsedAmountPaid, status],
  );
  const selectedStatusDescription =
    paymentStatusOptions.find((option) => option.value === status)?.description ??
    "";

  const paymentMutation = useMutation<
    InvoiceListItem,
    AppApiClientError,
    {
      status: InvoicePaymentStatus;
      amountPaid: number | null;
    }
  >({
    mutationFn: (payload) =>
      fetchAppApi<InvoiceListItem>(`/api/invoices/${invoice.id}/payment`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (updatedInvoice) => {
      setServerMessage(null);
      queryClient.setQueryData<InvoiceListItem[]>(
        invoiceQueryKeys.list(),
        (current) =>
          current?.map((item) =>
            item.id === updatedInvoice.id ? updatedInvoice : item,
          ),
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.list() }),
        queryClient.invalidateQueries({
          queryKey: invoiceQueryKeys.payment(invoice.id),
        }),
        queryClient.invalidateQueries({
          queryKey: roomQueryKeys.operationsSummary(invoice.roomId),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.all,
        }),
      ]);
      setOpen(false);
    },
    onError: (error) => {
      setServerMessage(error.message);
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setStatus(invoice.status);
      setAmountPaidInput(
        invoice.status === "Partially Paid" ? String(invoice.amountPaid) : "",
      );
      setServerMessage(null);
      paymentMutation.reset();
    }
  }

  function handleSubmit() {
    if (clientValidationMessage) {
      setServerMessage(clientValidationMessage);
      return;
    }

    paymentMutation.mutate({
      status,
      amountPaid: status === "Partially Paid" ? parsedAmountPaid : null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Cập nhật
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cập nhật thanh toán</DialogTitle>
          <DialogDescription>
            {invoice.shortId} · {invoice.roomName} · {invoice.periodLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4 sm:grid-cols-3">
            <PaymentFact label="Tổng tiền" value={formatCurrency(invoice.totalAmount)} />
            <PaymentFact label="Đã thu" value={formatCurrency(invoice.amountPaid)} />
            <PaymentFact label="Còn lại" value={formatCurrency(invoice.balanceDue)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`invoice-payment-status-${invoice.id}`}>
              Trạng thái
            </Label>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as InvoicePaymentStatus);
                setServerMessage(null);
              }}
              disabled={paymentMutation.isPending}
            >
              <SelectTrigger id={`invoice-payment-status-${invoice.id}`}>
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent>
                {paymentStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedStatusDescription}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`invoice-payment-amount-${invoice.id}`}>
              Số tiền đã thu
            </Label>
            <Input
              id={`invoice-payment-amount-${invoice.id}`}
              type="number"
              min="0"
              step="1000"
              value={
                status === "Paid"
                  ? invoice.totalAmount
                  : status === "Unpaid"
                    ? 0
                    : amountPaidInput
              }
              onChange={(event) => {
                setAmountPaidInput(event.target.value);
                setServerMessage(null);
              }}
              disabled={status !== "Partially Paid" || paymentMutation.isPending}
              aria-invalid={Boolean(clientValidationMessage || serverMessage)}
            />
            {status !== "Partially Paid" && (
              <p className="text-xs text-muted-foreground">
                Giá trị này được hệ thống tự đặt theo trạng thái đã chọn.
              </p>
            )}
          </div>

          {(clientValidationMessage || serverMessage) && (
            <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverMessage ?? clientValidationMessage}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={paymentMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={paymentMutation.isPending || Boolean(clientValidationMessage)}
          >
            {paymentMutation.isPending ? "Đang lưu..." : "Lưu thanh toán"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{value}</p>
    </div>
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
          Sau khi tạo hóa đơn từ màn hình chốt điện nước, invoice sẽ xuất hiện ở
          đây.
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
        <h2 className="text-lg font-semibold">
          Không tải được danh sách hóa đơn
        </h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="secondary" onClick={onRetry}>
          Thử lại
        </Button>
      </CardContent>
    </Card>
  );
}

function InvoiceBadge({ status }: { status: InvoicePaymentStatus }) {
  const variant =
    status === "Paid"
      ? "success"
      : status === "Partially Paid"
        ? "warning"
        : "destructive";

  return <Badge variant={variant}>{invoiceStatusLabel[status]}</Badge>;
}

function validatePaymentDraft({
  status,
  amountPaid,
  totalAmount,
}: {
  status: InvoicePaymentStatus;
  amountPaid: number | null;
  totalAmount: number;
}) {
  if (status !== "Partially Paid") {
    return null;
  }

  if (amountPaid === null) {
    return "Nhập số tiền đã thu khi chọn thanh toán một phần.";
  }

  if (amountPaid <= 0) {
    return "Số tiền đã thu phải lớn hơn 0.";
  }

  if (amountPaid >= totalAmount) {
    return "Thanh toán một phần phải nhỏ hơn tổng tiền hóa đơn.";
  }

  return null;
}

function parseMoneyInput(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function buildPeriodOptions({
  invoices,
  currentPeriod,
}: {
  invoices: InvoiceListItem[];
  currentPeriod: { key: string; label: string };
}) {
  const periodMap = new Map<string, string>([
    [currentPeriod.key, `${currentPeriod.label} (hiện tại)`],
  ]);

  for (const invoice of invoices) {
    if (!periodMap.has(getBillingPeriodKey(invoice))) {
      periodMap.set(getBillingPeriodKey(invoice), invoice.periodLabel);
    }
  }

  return Array.from(periodMap, ([key, label]) => ({ key, label }));
}

function getBillingPeriodKey(invoice: InvoiceListItem) {
  return `${invoice.billingPeriod.year}-${String(invoice.billingPeriod.month).padStart(2, "0")}`;
}

function getCurrentBillingPeriodOption() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  return {
    key: `${year}-${String(month).padStart(2, "0")}`,
    label: `${String(month).padStart(2, "0")}/${year}`,
  };
}
