"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { InvoicePdfExportButton } from "./invoice-pdf-export-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppApiClientError, fetchAppApi } from "@/lib/api/client";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { formatCurrency } from "@/lib/formatters";
import type { InvoiceRecord } from "@/lib/insforge/types";
import { invoiceStatusLabel } from "@/lib/invoices/presenter";
import { invoiceQueryKeys } from "@/lib/invoices/query-keys";
import { roomQueryKeys } from "@/lib/rooms/query-keys";
import type { UtilityMetricsView } from "@/lib/utilities/presenter";
import { utilityMetricsQueryKeys } from "@/lib/utilities/query-keys";

export function InvoiceGenerationForm({ view }: { view: UtilityMetricsView }) {
  const queryClient = useQueryClient();
  const [otherFee, setOtherFee] = useState(String(view.invoice?.otherFee ?? 0));
  const [otherFeeNote, setOtherFeeNote] = useState(view.invoice?.otherFeeNote ?? "");
  const [discountAmount, setDiscountAmount] = useState(String(view.invoice?.discountAmount ?? 0));
  const [discountNote, setDiscountNote] = useState(view.invoice?.discountNote ?? "");
  const [message, setMessage] = useState<{ status: "success" | "error"; text: string } | null>(null);
  const canGenerate = Boolean(view.persistedMetricId && view.activeContractId);
  const generateMutation = useMutation({
    mutationFn: () => fetchAppApi<InvoiceRecord>(`/api/rooms/${view.room.id}/invoices`, {
      method: "POST",
      cache: "no-store",
      body: JSON.stringify({
        month: view.billingPeriod.month,
        year: view.billingPeriod.year,
        otherFee,
        otherFeeNote,
        discountAmount,
        discountNote,
      }),
    }),
    onSuccess: async (invoice) => {
      setOtherFee(String(invoice.other_fee));
      setOtherFeeNote(invoice.other_fee_note ?? "");
      setDiscountAmount(String(invoice.discount_amount));
      setDiscountNote(invoice.discount_note ?? "");
      const text = `Đã tạo/cập nhật hóa đơn kỳ ${view.periodLabel}.`;
      setMessage({ status: "success", text });
      toast.success(text);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: utilityMetricsQueryKeys.room(view.room.id) }),
        queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.list() }),
        queryClient.invalidateQueries({ queryKey: roomQueryKeys.operationsSummary(view.room.id) }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
      ]);
    },
    onError: (error) => {
      const text = error instanceof Error ? error.message : "Không tạo/cập nhật được hóa đơn.";
      setMessage({ status: "error", text });
      toast.error(text);
    },
  });
  const fieldErrors = getFieldErrors(generateMutation.error);

  function clearFeedback() {
    if (generateMutation.isError) generateMutation.reset();
    if (message?.status === "error") setMessage(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canGenerate || generateMutation.isPending) return;
    setMessage(null);
    generateMutation.mutate();
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Hóa đơn kỳ {view.periodLabel}</CardTitle>
            <CardDescription>Tạo hoặc cập nhật hóa đơn từ chỉ số đã lưu</CardDescription>
          </div>
          <Badge variant={view.invoice ? "success" : "secondary"}>
            {view.invoice ? "Đã có hóa đơn" : "Chưa có hóa đơn"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="min-w-0 space-y-5">
          <div className="rounded-2xl border border-white/50 bg-background/40 p-4 clay-inset dark:border-white/10">
            <p className="text-sm font-semibold">Điều chỉnh hóa đơn</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Phụ thu được cộng vào tổng tiền; giảm giá được trừ sau cùng.
            </p>
            <div className="mt-4 grid min-w-0 gap-5 2xl:grid-cols-2">
              <AdjustmentFields
                amountId="invoice-other-fee"
                amountLabel="Phí khác"
                amount={otherFee}
                amountError={fieldErrors.otherFee}
                amountHint="Mặc định 0 nếu kỳ này không có phụ thu."
                noteId="invoice-other-fee-note"
                noteLabel="Ghi chú phí khác"
                note={otherFeeNote}
                noteError={fieldErrors.otherFeeNote}
                noteHint="Bắt buộc khi phí khác lớn hơn 0."
                notePlaceholder="Ví dụ: phụ thu vệ sinh, sửa khóa, gửi xe..."
                disabled={!canGenerate || generateMutation.isPending}
                onAmountChange={(value) => { clearFeedback(); setOtherFee(value); }}
                onNoteChange={(value) => { clearFeedback(); setOtherFeeNote(value); }}
              />
              <AdjustmentFields
                amountId="invoice-discount-amount"
                amountLabel="Giảm giá"
                amount={discountAmount}
                amountError={fieldErrors.discountAmount}
                amountHint="Mặc định 0 nếu kỳ này không có giảm giá."
                noteId="invoice-discount-note"
                noteLabel="Ghi chú giảm giá"
                note={discountNote}
                noteError={fieldErrors.discountNote}
                noteHint="Bắt buộc khi giảm giá lớn hơn 0."
                notePlaceholder="Ví dụ: hỗ trợ sửa chữa, ưu đãi khách thuê..."
                disabled={!canGenerate || generateMutation.isPending}
                onAmountChange={(value) => { clearFeedback(); setDiscountAmount(value); }}
                onNoteChange={(value) => { clearFeedback(); setDiscountNote(value); }}
              />
            </div>
          </div>

          {view.invoice && <InvoiceSummary view={view} />}

          {!canGenerate && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Cần lưu chỉ số điện nước và có hợp đồng hợp lệ trước khi tạo hóa đơn.
            </p>
          )}

          <InvoicePdfExportButton roomId={view.room.id} billingPeriod={view.billingPeriod} hasInvoice={Boolean(view.invoice)} />

          {message && (
            <p className={message.status === "success"
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
              : "rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"}>
              {message.text}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={!canGenerate || generateMutation.isPending}>
            {generateMutation.isPending ? "Đang lưu hóa đơn..." : view.invoice ? "Cập nhật hóa đơn" : "Tạo hóa đơn"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function InvoiceSummary({ view }: { view: UtilityMetricsView }) {
  const invoice = view.invoice!;
  return (
    <div className="rounded-2xl border border-white/40 bg-background/35 p-4 clay-inset dark:border-white/8">
      <DetailRow label="Trạng thái" value={invoiceStatusLabel[invoice.status]} />
      {invoice.otherFee > 0 && <>
        <DetailRow label="Phí khác" value={formatCurrency(invoice.otherFee)} />
        <DetailRow label="Ghi chú phí khác" value={invoice.otherFeeNote ?? "Chưa có ghi chú"} />
      </>}
      {invoice.discountAmount > 0 && <>
        <DetailRow label="Giảm giá" value={`− ${formatCurrency(invoice.discountAmount)}`} />
        <DetailRow label="Lý do giảm giá" value={invoice.discountNote ?? "Chưa có ghi chú"} />
      </>}
      <DetailRow label="Tổng tiền" value={formatCurrency(invoice.totalAmount)} />
      <DetailRow label="Đã thu" value={formatCurrency(invoice.amountPaid)} />
    </div>
  );
}

type AdjustmentFieldsProps = {
  amountId: string; amountLabel: string; amount: string; amountError?: string; amountHint: string;
  noteId: string; noteLabel: string; note: string; noteError?: string; noteHint: string;
  notePlaceholder: string; disabled: boolean; onAmountChange: (value: string) => void;
  onNoteChange: (value: string) => void;
};

function AdjustmentFields(props: AdjustmentFieldsProps) {
  return (
    <div className="min-w-0 space-y-4 rounded-2xl border border-border/60 bg-card/55 p-4">
      <div className="grid gap-2">
        <Label htmlFor={props.amountId}>{props.amountLabel}</Label>
        <Input id={props.amountId} type="number" inputMode="decimal" min={0} step="1000"
          value={props.amount} aria-invalid={Boolean(props.amountError)} disabled={props.disabled}
          onChange={(event) => props.onAmountChange(event.target.value)} />
        <p className={props.amountError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {props.amountError ?? props.amountHint}
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={props.noteId}>{props.noteLabel}</Label>
        <Textarea id={props.noteId} value={props.note} placeholder={props.notePlaceholder}
          aria-invalid={Boolean(props.noteError)} disabled={props.disabled} rows={3}
          onChange={(event) => props.onNoteChange(event.target.value)} />
        <p className={props.noteError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {props.noteError ?? props.noteHint}
        </p>
      </div>
    </div>
  );
}

function getFieldErrors(error: Error | null) {
  if (!(error instanceof AppApiClientError)) return {} as Record<string, string>;
  const details = error.details;
  if (typeof details !== "object" || details === null || !("fieldErrors" in details)
    || typeof details.fieldErrors !== "object" || details.fieldErrors === null) {
    return {} as Record<string, string>;
  }
  return details.fieldErrors as Record<string, string>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 border-b border-border py-2 first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-sm font-medium sm:max-w-64 sm:text-right">{value}</span>
    </div>
  );
}
