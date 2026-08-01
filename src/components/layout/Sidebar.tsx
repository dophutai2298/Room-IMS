"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navItems = [
  { name: "Tổng quan", href: "/" },
  { name: "Phòng trọ", href: "/rooms" },
  { name: "Hóa đơn & Thu tiền", href: "/invoices" },
];

export const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="border-b border-border bg-card/80 backdrop-blur lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col gap-5 px-4 py-4 lg:px-5 lg:py-6">
        <Link href="/" className="flex items-center gap-3 rounded-lg">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            RR
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-5">
              Rental Room
            </span>
            <span className="block text-xs text-muted-foreground">
              Quản lý vận hành
            </span>
          </span>
        </Link>

        <nav aria-label="Điều hướng chính" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-accent text-accent-foreground",
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden rounded-xl border border-border bg-muted/40 p-4 text-sm lg:block">
          <p className="font-medium">Demo UI</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Dữ liệu hiện tại là mock để kiểm tra giao diện trước khi nối
            InsForge.
          </p>
        </div>
      </div>
    </aside>
  );
};
