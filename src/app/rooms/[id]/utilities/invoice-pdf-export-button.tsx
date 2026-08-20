"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AppApiClientError, fetchAppFile } from "@/lib/api/client";
import type { BillingPeriod } from "@/lib/utilities/presenter";

export function InvoicePdfExportButton({
  roomId,
  billingPeriod,
  hasInvoice,
}: {
  roomId: string;
  billingPeriod: BillingPeriod;
  hasInvoice: boolean;
}) {
  const downloadMutation = useMutation({
    mutationFn: async () => {
      const searchParams = new URLSearchParams({
        month: String(billingPeriod.month),
        year: String(billingPeriod.year),
      });
      const response = await fetchAppFile(
        `/api/rooms/${encodeURIComponent(roomId)}/invoices/pdf?${searchParams}`,
        {
          headers: { Accept: "application/pdf" },
        },
      );
      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.toLowerCase().startsWith("application/pdf")) {
        throw new AppApiClientError({
          kind: "internal",
          code: "INVALID_PDF_RESPONSE",
          message: "Hệ thống trả về file không đúng định dạng PDF.",
          status: 500,
        });
      }

      const blob = await response.blob();
      downloadBlob({
        blob,
        filename: readDownloadFilename(response) ?? "hoa-don.pdf",
      });
    },
    onSuccess: () => {
      toast.success("Đã tải hóa đơn PDF.");
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể xuất hóa đơn PDF. Vui lòng thử lại.";
      toast.error(message);
    },
    retry: false,
  });
  const errorMessage = downloadMutation.error?.message ?? null;

  return (
    <div className="space-y-2 rounded-2xl border border-white/40 bg-background/35 p-4 clay-inset dark:border-white/8">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={!hasInvoice || downloadMutation.isPending}
        onClick={() => downloadMutation.mutate()}
      >
        <span aria-hidden="true">↓</span>
        {downloadMutation.isPending ? "Đang tạo PDF..." : "Tải hóa đơn PDF"}
      </Button>

      {!hasInvoice && (
        <p className="text-xs text-muted-foreground">
          Cần tạo hóa đơn cho kỳ này trước khi có thể tải PDF.
        </p>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {errorMessage} Bạn có thể bấm tải lại để thử lại.
        </p>
      )}
    </div>
  );
}

function readDownloadFilename(response: Response) {
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename="([^"]+)"/i);
  const filename = match?.[1]?.split(/[\\/]/).pop()?.trim();

  return filename?.toLowerCase().endsWith(".pdf") ? filename : null;
}

function downloadBlob({ blob, filename }: { blob: Blob; filename: string }) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
