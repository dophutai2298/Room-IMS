"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { AppApiClientError, fetchAppApi } from "@/lib/api/client";
import { createDataTableColumnHelper } from "@/lib/data-table/tanstack";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { formatCurrency } from "@/lib/formatters";
import {
  invoiceStatusLabel,
  type InvoiceListItem,
  type InvoicePaymentStatus,
} from "@/lib/invoices/presenter";
import { invoiceQueryKeys } from "@/lib/invoices/query-keys";
import {
  buildInvoicePaymentEndpoint,
  buildInvoiceUtilityDetailHref,
} from "@/lib/invoices/table-actions";
import { roomQueryKeys } from "@/lib/rooms/query-keys";

const invoiceColumnHelper = createDataTableColumnHelper<InvoiceListItem>();

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

  return (
    <InvoiceTable
      errorMessage={
        invoicesQuery.isError ? invoicesQuery.error.message : undefined
      }
      invoices={invoicesQuery.data ?? []}
      isFetching={invoicesQuery.isFetching}
      isLoading={invoicesQuery.isPending}
      onRetry={() => void invoicesQuery.refetch()}
    />
  );
}

function InvoiceTable({
  errorMessage,
  invoices,
  isFetching,
  isLoading,
  onRetry,
}: {
  errorMessage?: string;
  invoices: InvoiceListItem[];
  isFetching: boolean;
  isLoading: boolean;
  onRetry: () => void;
}) {
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
  const columns = useMemo(
    () =>
      invoiceColumnHelper.columns([
        invoiceColumnHelper.accessor("shortId", {
          header: "Mã HĐ",
          cell: (info) => (
            <span className="font-mono text-xs tabular-nums">
              {info.getValue()}
            </span>
          ),
          sortFn: "alphanumeric",
        }),
        invoiceColumnHelper.accessor("periodLabel", {
          header: "Kỳ thu",
          sortFn: "alphanumeric",
        }),
        invoiceColumnHelper.accessor("roomName", {
          header: "Phòng",
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
          sortFn: "alphanumeric",
        }),
        invoiceColumnHelper.accessor("roomFee", {
          header: "Tiền thuê",
          cell: (info) => (
            <span className="font-mono tabular-nums">
              {formatCurrency(info.getValue())}
            </span>
          ),
          enableGlobalFilter: false,
        }),
        invoiceColumnHelper.accessor("electricityFee", {
          header: "Điện",
          cell: (info) => (
            <span className="font-mono tabular-nums">
              {formatCurrency(info.getValue())}
            </span>
          ),
          enableGlobalFilter: false,
        }),
        invoiceColumnHelper.accessor("waterFee", {
          header: "Nước",
          cell: (info) => (
            <span className="font-mono tabular-nums">
              {formatCurrency(info.getValue())}
            </span>
          ),
          enableGlobalFilter: false,
        }),
        invoiceColumnHelper.accessor("otherFee", {
          header: "Phí khác",
          cell: (info) => {
            const invoice = info.row.original;

            return (
              <div>
                <div className="font-mono tabular-nums">
                  {formatCurrency(invoice.otherFee)}
                </div>
                {invoice.otherFee > 0 && (
                  <p className="mt-1 max-w-[14rem] text-xs leading-5 text-muted-foreground">
                    {invoice.otherFeeNote ?? "Chưa có ghi chú"}
                  </p>
                )}
              </div>
            );
          },
          enableGlobalFilter: false,
        }),
        invoiceColumnHelper.accessor("totalAmount", {
          header: "Tổng tiền",
          cell: (info) => (
            <span className="font-mono font-semibold tabular-nums">
              {formatCurrency(info.getValue())}
            </span>
          ),
          enableGlobalFilter: false,
        }),
        invoiceColumnHelper.accessor("amountPaid", {
          header: "Đã thu",
          cell: (info) => (
            <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
              {formatCurrency(info.getValue())}
            </span>
          ),
          enableGlobalFilter: false,
        }),
        invoiceColumnHelper.accessor("balanceDue", {
          header: "Còn lại",
          cell: (info) => (
            <span className="font-mono tabular-nums text-amber-700 dark:text-amber-300">
              {formatCurrency(info.getValue())}
            </span>
          ),
          enableGlobalFilter: false,
        }),
        invoiceColumnHelper.accessor("status", {
          header: "Trạng thái",
          cell: (info) => <InvoiceBadge status={info.getValue()} />,
          enableGlobalFilter: false,
          filterFn: "equalsString",
          sortFn: "alphanumeric",
        }),
        invoiceColumnHelper.display({
          id: "actions",
          header: "Thao tác",
          cell: ({ row }) => (
            <div className="flex justify-end gap-2">
              <RecordPaymentDialog invoice={row.original} />
              <Button asChild variant="outline" size="sm">
                <Link
                  href={buildInvoiceUtilityDetailHref(row.original)}
                >
                  Xem chi tiết
                </Link>
              </Button>
            </div>
          ),
          enableHiding: false,
          enableSorting: false,
        }),
      ]),
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={filteredInvoices}
      emptyMessage={
        invoices.length === 0
          ? "Sau khi tạo hóa đơn từ màn hình chốt điện nước, invoice sẽ xuất hiện ở đây."
          : "Không có hóa đơn trong kỳ đã chọn."
      }
      emptyTitle={
        invoices.length === 0 ? "Chưa có hóa đơn nào" : "Không có hóa đơn"
      }
      errorMessage={errorMessage}
      filteredEmptyMessage="Thử đổi từ khóa search, trạng thái thanh toán, hoặc kỳ thu."
      filteredEmptyTitle="Không tìm thấy hóa đơn"
      isFetching={isFetching}
      isLoading={isLoading}
      onRetry={onRetry}
      searchPlaceholder="Tìm mã hóa đơn hoặc phòng..."
      statusFilter={{
        columnId: "status",
        label: "Lọc trạng thái",
        allLabel: "Tất cả trạng thái",
        options: paymentStatusOptions.map((option) => ({
          value: option.value,
          label: option.label,
        })),
      }}
      title="Danh sách hóa đơn"
      toolbarStart={
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
      }
    />
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
      fetchAppApi<InvoiceListItem>(buildInvoicePaymentEndpoint(invoice.id), {
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
            <PaymentFact
              label="Tổng tiền"
              value={formatCurrency(invoice.totalAmount)}
            />
            <PaymentFact
              label="Đã thu"
              value={formatCurrency(invoice.amountPaid)}
            />
            <PaymentFact
              label="Còn lại"
              value={formatCurrency(invoice.balanceDue)}
            />
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
