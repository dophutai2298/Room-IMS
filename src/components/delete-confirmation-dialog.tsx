"use client";

import type { ReactNode } from "react";

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

type DeleteConfirmationDialogProps = {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  onConfirm: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isPending?: boolean;
  errorMessage?: ReactNode;
  cancelLabel?: ReactNode;
  confirmLabel?: ReactNode;
  pendingConfirmLabel?: ReactNode;
};

export function DeleteConfirmationDialog({
  trigger,
  title,
  description,
  onConfirm,
  open,
  onOpenChange,
  isPending = false,
  errorMessage,
  cancelLabel = "Hủy",
  confirmLabel = "Xác nhận xóa",
  pendingConfirmLabel = "Đang xóa...",
}: DeleteConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? pendingConfirmLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
