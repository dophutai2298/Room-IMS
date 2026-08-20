"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { generateMonthlyInvoice } from "./actions";
import { initialInvoiceGenerationActionState } from "./invoice-generation-state";
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
import { formatCurrency } from "@/lib/formatters";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import type { UtilityMetricsView } from "@/lib/utilities/presenter";
import { invoiceStatusLabel } from "@/lib/invoices/presenter";
import { invoiceQueryKeys } from "@/lib/invoices/query-keys";
import { roomQueryKeys } from "@/lib/rooms/query-keys";
import { utilityMetricsQueryKeys } from "@/lib/utilities/query-keys";

export function InvoiceGenerationForm({ view }: { view: UtilityMetricsView }) {
  const queryClient = useQueryClient();
  const [state, formAction] = useActionState(
    generateMonthlyInvoice,
    initialInvoiceGenerationActionState,
  );
  const canGenerate = Boolean(view.persistedMetricId && view.activeContractId);
  const defaultOtherFee =
    state.fields.otherFee || String(view.invoice?.otherFee ?? 0);
  const defaultOtherFeeNote =
    state.fields.otherFeeNote ?? view.invoice?.otherFeeNote ?? "";

  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.status === "success") {
      toast.success(state.message);
      void Promise.all([
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
      return;
    }

    if (state.status === "error") {
      toast.error(state.message);
    }
  }, [queryClient, state.message, state.status, view.room.id]);

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
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="roomId" value={view.room.id} />
          <input type="hidden" name="month" value={view.billingPeriod.month} />
          <input type="hidden" name="year" value={view.billingPeriod.year} />

          <div className="grid gap-2">
            <Label htmlFor="invoice-other-fee">Phí khác</Label>
            <Input
              id="invoice-other-fee"
              name="otherFee"
              type="number"
              inputMode="decimal"
              min={0}
              step="1000"
              defaultValue={defaultOtherFee}
              aria-invalid={Boolean(state.fieldErrors.otherFee)}
              disabled={!canGenerate}
            />
            <p
              className={
                state.fieldErrors.otherFee
                  ? "text-xs text-destructive"
                  : "text-xs text-muted-foreground"
              }
            >
              {state.fieldErrors.otherFee ??
                "Mặc định 0 nếu kỳ này không có phụ thu."}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invoice-other-fee-note">Ghi chú phí khác</Label>
            <Textarea
              id="invoice-other-fee-note"
              name="otherFeeNote"
              defaultValue={defaultOtherFeeNote}
              placeholder="Ví dụ: phụ thu vệ sinh, sửa khóa, gửi xe..."
              aria-invalid={Boolean(state.fieldErrors.otherFeeNote)}
              disabled={!canGenerate}
              rows={3}
            />
            <p
              className={
                state.fieldErrors.otherFeeNote
                  ? "text-xs text-destructive"
                  : "text-xs text-muted-foreground"
              }
            >
              {state.fieldErrors.otherFeeNote ??
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

          {state.message && (
            <p
              className={
                state.status === "success"
                  ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                  : "rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              }
            >
              {state.message}
            </p>
          )}

          <GenerateButton
            disabled={!canGenerate}
            label={view.invoice ? "Cập nhật hóa đơn" : "Tạo hoá đơn"}
          />
        </form>
      </CardContent>
    </Card>
  );
}

function GenerateButton({
  disabled,
  label,
}: {
  disabled: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={disabled || pending}>
      {pending ? "Dang tao..." : label}
    </Button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 first:pt-0 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
