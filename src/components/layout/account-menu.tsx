"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  const signOutMutation = useSignOutMutation();
  const initials = getInitials(user?.displayName);
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const accountLabel =
    user?.role === "staff" ? "Tài khoản Nhân viên" : "Tài khoản Admin";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex size-9 items-center justify-center rounded-xl bg-accent text-xs font-semibold text-accent-foreground shadow-sm outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={accountLabel}
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        disabled={isLoading}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isLoading ? "…" : initials}
      </button>
      {isOpen && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-64 rounded-2xl border border-white/60 bg-card/95 p-2 opacity-100 shadow-xl backdrop-blur-2xl dark:border-white/10"
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
          {/* {user?.role === "landlord" && (
          <Button
            asChild
            variant="ghost"
            className="mt-1 w-full justify-start"
          >
            <Link href="/staff" role="menuitem">
              Quản lý Nhân viên
            </Link>
          </Button>
        )} */}
          <Button
            type="button"
            variant="ghost"
            className="mt-1 w-full justify-start text-destructive hover:text-destructive cursor-pointer"
            role="menuitem"
            disabled={signOutMutation.isPending}
            onClick={() => {
              setIsOpen(false);
              signOutMutation.mutate();
            }}
          >
            {signOutMutation.isPending ? "Đang đăng xuất..." : "Đăng xuất"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function MobileAccountMenu({
  user,
  isLoading,
}: {
  user: AppUser | undefined;
  isLoading: boolean;
}) {
  const signOutMutation = useSignOutMutation();
  const initials = getInitials(user?.displayName);
  const accountLabel =
    user?.role === "staff" ? "Tài khoản Nhân viên" : "Tài khoản Admin";

  return (
    <section
      aria-label={accountLabel}
      className="rounded-2xl border border-white/55 bg-background/45 p-3.5 clay-inset dark:border-white/10"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground shadow-sm">
          {isLoading ? "…" : initials}
        </span>
        <div className="min-w-0">
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
      </div>

      <Button
        type="button"
        variant="ghost"
        className="mt-3 w-full justify-start text-destructive hover:text-destructive cursor-pointer"
        disabled={signOutMutation.isPending || isLoading}
        onClick={() => signOutMutation.mutate()}
      >
        {signOutMutation.isPending ? "Đang đăng xuất..." : "Đăng xuất"}
      </Button>
    </section>
  );
}

function useSignOutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signOutCurrentSession,
    onSuccess: () => {
      queryClient.clear();
      window.location.assign("/sign-in");
    },
    onError: (error) => {
      toast.error(error.message || "Không thể đăng xuất.");
    },
  });
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
