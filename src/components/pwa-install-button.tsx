"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type InstallPlatform,
} from "@/lib/pwa/install-state";
import { usePwaInstall } from "@/lib/pwa/use-pwa-install";
import { cn } from "@/lib/utils";

const installInstructions: Record<InstallPlatform, string[]> = {
  ios: [
    "Mở trang này bằng Safari.",
    "Chạm nút Chia sẻ ở thanh công cụ.",
    "Chọn “Thêm vào Màn hình chính”, sau đó chọn “Thêm”.",
  ],
  android: [
    "Mở menu trình duyệt ở góc trên bên phải.",
    "Chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”.",
    "Xác nhận để tạo icon Rental Room.",
  ],
  desktop: [
    "Mở menu cài đặt của Chrome hoặc Edge.",
    "Chọn “Cài đặt Rental Room” trong mục ứng dụng.",
    "Xác nhận để mở hệ thống ở cửa sổ ứng dụng riêng.",
  ],
};

export function PwaInstallButton({
  className,
  responsiveLabel = false,
}: {
  className?: string;
  responsiveLabel?: boolean;
}) {
  const {
    hydrated,
    instructionsOpen,
    isInstallEnvironmentSupported,
    isInstalled,
    isPrompting,
    platform,
    requestInstall,
    setInstructionsOpen,
  } = usePwaInstall();

  if (!hydrated || !isInstallEnvironmentSupported || isInstalled) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "border-white/60 bg-card/60 dark:border-white/10",
          responsiveLabel &&
            "size-10 px-0 min-[1180px]:w-auto min-[1180px]:px-3",
          className,
        )}
        onClick={() => void requestInstall()}
        disabled={isPrompting}
        aria-label="Cài ứng dụng Rental Room"
      >
        <InstallIcon />
        <span className={cn(responsiveLabel && "hidden min-[1180px]:inline")}>
          {isPrompting ? "Đang mở..." : "Cài ứng dụng"}
        </span>
      </Button>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent className="clay-surface border-white/60 bg-card/95 dark:border-white/10">
          <DialogHeader>
            <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <InstallIcon className="size-6" />
            </div>
            <DialogTitle>Cài Rental Room trên thiết bị</DialogTitle>
            <DialogDescription>
              Sau khi thêm vào màn hình chính, bạn có thể mở hệ thống trực tiếp
              từ icon như một ứng dụng.
            </DialogDescription>
          </DialogHeader>

          <InstallInstructions platform={platform} />

          <p className="rounded-xl border border-white/50 bg-muted/45 px-3 py-2.5 text-xs leading-5 text-muted-foreground clay-inset dark:border-white/10">
            Dữ liệu quản lý vẫn được tải an toàn từ hệ thống khi bạn đăng nhập;
            ứng dụng không lưu offline API, hóa đơn hoặc ảnh hồ sơ.
          </p>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button">Đã hiểu</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InstallInstructions({ platform }: { platform: InstallPlatform }) {
  return (
    <ol className="grid gap-2 text-sm leading-6 text-foreground">
      {installInstructions[platform].map((instruction, index) => (
        <li key={instruction}>
          {index + 1}. {instruction}
        </li>
      ))}
    </ol>
  );
}

function InstallIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4", className)}
    >
      <path d="M12 3v11" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
