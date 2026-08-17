"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { signOutCurrentSession } from "@/lib/auth/client";
import type { AppUser } from "@/lib/insforge/types";

export function AccountMenu({
  user,
  isLoading,
}: {
  user: AppUser | undefined;
  isLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const signOutMutation = useMutation({
    mutationFn: signOutCurrentSession,
    onSuccess: () => {
      queryClient.clear();
      window.location.assign("/sign-in");
    },
    onError: (error) => {
      toast.error(error.message || "Không thể đăng xuất.");
    },
  });
  const initials = getInitials(user?.displayName);
  const accountLabel =
    user?.role === "staff" ? "Tài khoản Nhân viên" : "Tài khoản Admin";

  return (
    <div className="group relative">
      <button
        type="button"
        className="flex size-9 items-center justify-center rounded-xl bg-accent text-xs font-semibold text-accent-foreground shadow-sm outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={accountLabel}
        aria-haspopup="menu"
        disabled={isLoading}
      >
        {isLoading ? "…" : initials}
      </button>
      <div
        role="menu"
        className="invisible absolute right-0 top-full z-50 w-64 translate-y-1 rounded-2xl border border-white/60 bg-card/95 p-2 opacity-0 shadow-xl backdrop-blur-2xl transition-[opacity,transform,visibility] group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:border-white/10"
      >
        <div className="border-b border-border/70 px-3 py-2.5">
          <p className="truncate text-sm font-semibold">
            {user?.displayName ?? "Tài khoản vận hành"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {user?.email ?? "Đang tải thông tin..."}
          </p>
          {user && (
            <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-primary">
              {user.role === "landlord" ? "Admin" : "Nhân viên"}
            </p>
          )}
        </div>
        {user?.role === "landlord" && (
          <Button
            asChild
            variant="ghost"
            className="mt-1 w-full justify-start"
          >
            <Link href="/staff" role="menuitem">
              Quản lý Nhân viên
            </Link>
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="mt-1 w-full justify-start text-destructive hover:text-destructive cursor-pointer"
          role="menuitem"
          disabled={signOutMutation.isPending}
          onClick={() => signOutMutation.mutate()}
        >
          {signOutMutation.isPending ? "Đang đăng xuất..." : "Đăng xuất"}
        </Button>
      </div>
    </div>
  );
}

function getInitials(displayName: string | undefined) {
  if (!displayName?.trim()) {
    return "TK";
  }

  return displayName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
