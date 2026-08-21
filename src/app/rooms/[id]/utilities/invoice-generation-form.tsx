"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { InvoicePdfExportButton } from "./invoice-pdf-export-button";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { AppApiClientError, fetchAppApi } from "@/lib/api/client";
import { formatCurrency } from "@/lib/formatters";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import type { InvoiceRecord } from "@/lib/insforge/types";
import type { UtilityMetricsView } from "@/lib/utilities/presenter";
import { invoiceStatusLabel } from "@/lib/invoices/presenter";
import { invoiceQueryKeys } from "@/lib/invoices/query-keys";
import { roomQueryKeys } from "@/lib/rooms/query-keys";
import { utilityMetricsQueryKeys } from "@/lib/utilities/query-keys";

export function InvoiceGenerationForm({ view }: { view: UtilityMetricsView }) {
  const queryClient = useQueryClient();
  const [otherFee, setOtherFee] = useState(String(view.invoice?.otherFee ?? 0));
  const [otherFeeNote, setOtherFeeNote] = useState(
    view.invoice?.otherFeeNote ?? "",
  );
  const [message, setMessage] = useState<{
    status: "success" | "error";
    text: string;
  } | null>(null);
  const canGenerate = Boolean(view.persistedMetricId && view.activeContractId);
  const generateMutation = useMutation({
    mutationFn: () =>
      fetchAppApi<InvoiceRecord>(`/api/rooms/${view.room.id}/invoices`, {
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({
          month: view.billingPeriod.month,
          year: view.billingPeriod.year,
          otherFee,
          otherFeeNote,
        }),
      }),
    onSuccess: async (invoice) => {
      setOtherFee(String(invoice.other_fee));
      setOtherFeeNote(invoice.other_fee_note ?? "");
      const successMessage = `Đã tạo/cập nhật hóa đơn kỳ ${view.periodLabel}.`;
      setMessage({ status: "success", text: successMessage });
      toast.success(successMessage);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: utilityMetricsQueryKeys.room(view.room.id),
        }),
        queryClient.invalidateQueries({
          queryKey: invoiceQueryKeys.list(),
        }),
        queryClient.invalidateQueries({
          queryKey: roomQueryKeys.operationsSummary(view.room.id),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.all,
        }),
      ]);
    },
    onError: (error) => {
      const text =
        error instanceof Error
          ? error.message
          : "Không tạo/cập nhật được hóa đơn.";
      setMessage({ status: "error", text });
      toast.error(text);
    },
  });
  const fieldErrors = getInvoiceGenerationFieldErrors(generateMutation.error);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canGenerate || generateMutation.isPending) {
      return;
    }

    setMessage(null);
    generateMutation.mutate();
  }

  function clearServerFeedback() {
    if (generateMutation.isError) {
      generateMutation.reset();
    }

    if (message?.status === "error") {
      setMessage(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Hóa đơn kỳ {view.periodLabel}</CardTitle>
            <CardDescription>
              Tạo hoặc cập nhật Hóa đơn từ chỉ số đã lưu
            </CardDescription>
          </div>
          <Badge variant={view.invoice ? "success" : "secondary"}>
            {view.invoice ? "Đã có hóa đơn" : "Chưa có hóa đơn"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="grid gap-2">
            <Label htmlFor="invoice-other-fee">Phí khác</Label>
            <Input
              id="invoice-other-fee"
              type="number"
              inputMode="decimal"
              min={0}
              step="1000"
              value={otherFee}
              aria-invalid={Boolean(fieldErrors.otherFee)}
              disabled={!canGenerate || generateMutation.isPending}
              onChange={(event) => {
                clearServerFeedback();
                setOtherFee(event.target.value);
              }}
            />
            <p
              className={
                fieldErrors.otherFee
                  ? "text-xs text-destructive"
                  : "text-xs text-muted-foreground"
              }
            >
              {fieldErrors.otherFee ??
                "Mặc định 0 nếu kỳ này không có phụ thu."}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invoice-other-fee-note">Ghi chú phí khác</Label>
            <Textarea
              id="invoice-other-fee-note"
              value={otherFeeNote}
              placeholder="Ví dụ: phụ thu vệ sinh, sửa khóa, gửi xe..."
              aria-invalid={Boolean(fieldErrors.otherFeeNote)}
              disabled={!canGenerate || generateMutation.isPending}
              rows={3}
              onChange={(event) => {
                clearServerFeedback();
                setOtherFeeNote(event.target.value);
              }}
            />
            <p
              className={
                fieldErrors.otherFeeNote
                  ? "text-xs text-destructive"
                  : "text-xs text-muted-foreground"
              }
            >
              {fieldErrors.otherFeeNote ??
                "Bắt buộc khi phí khác lớn hơn 0 để hóa đơn có thể audit lại."}
            </p>
          </div>

          {view.invoice && (
            <div className="rounded-2xl border border-white/40 bg-background/35 p-4 clay-inset dark:border-white/8">
              <DetailRow label="Trạng thái" value={invoiceStatusLabel[view?.invoice?.status]} />
              <DetailRow
                label="Tổng tiền"
                value={formatCurrency(view.invoice.totalAmount)}
              />
              <DetailRow
                label="Đã thu"
                value={formatCurrency(view.invoice.amountPaid)}
              />
              {view.invoice.otherFee > 0 && (
                <DetailRow
                  label="Ghi chú phí khác"
                  value={view.invoice.otherFeeNote ?? "Chưa có ghi chú"}
                />
              )}
            </div>
          )}

          {!canGenerate && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Cần lưu chỉ số Điện - Nước và đã có Hợp đồng trước khi tạo hoá đơn.
            </p>
          )}

          <InvoicePdfExportButton
            roomId={view.room.id}
            billingPeriod={view.billingPeriod}
            hasInvoice={Boolean(view.invoice)}
          />

          {message && (
            <p
              className={
                message.status === "success"
                  ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                  : "rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              }
            >
              {message.text}
            </p>
          )}

          <GenerateButton
            disabled={!canGenerate}
            pending={generateMutation.isPending}
            label={view.invoice ? "Cập nhật hóa đơn" : "Tạo hoá đơn"}
          />
        </form>
      </CardContent>
    </Card>
  );
}

function GenerateButton({
  disabled,
  pending,
  label,
}: {
  disabled: boolean;
  pending: boolean;
  label: string;
}) {
  return (
    <Button type="submit" className="w-full" disabled={disabled || pending}>
      {pending ? "Dang tao..." : label}
    </Button>
  );
}

function getInvoiceGenerationFieldErrors(error: Error | null) {
  if (!(error instanceof AppApiClientError)) {
    return {} as Record<string, string>;
  }

  const details = error.details;

  if (
    typeof details !== "object" ||
    details === null ||
    !("fieldErrors" in details) ||
    typeof details.fieldErrors !== "object" ||
    details.fieldErrors === null
  ) {
    return {} as Record<string, string>;
  }

  return details.fieldErrors as Record<string, string>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 first:pt-0 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
