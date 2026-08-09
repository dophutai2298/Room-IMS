"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Tổng quan", href: "/", icon: "overview" },
  { name: "Phòng trọ", href: "/rooms", icon: "rooms" },
  { name: "Tenant", href: "/tenants", icon: "tenants" },
  { name: "Hóa đơn", href: "/invoices", icon: "invoice" },
  { name: "Bảng giá", href: "/utility-pricing", icon: "pricing" },
];

export const Sidebar = () => {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="clay-surface mx-auto flex max-w-[1480px] items-center gap-3 rounded-[1.4rem] border border-white/60 bg-card/75 px-3 py-2.5 backdrop-blur-2xl dark:border-white/10 sm:px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-xl pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-9 items-center justify-center rounded-xl border border-white/30 bg-primary text-xs font-bold tracking-tight text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.28)]">
            RR
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block text-sm font-semibold leading-5">
              Rental Room 201 CV
            </span>
            <span className="block text-[0.68rem] text-muted-foreground">
              Vận hành nhà trọ
            </span>
          </span>
        </Link>

        <nav
          aria-label="Điều hướng chính"
          className="mx-auto flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl bg-muted/45 p-1 clay-inset"
        >
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
                  "flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium text-muted-foreground outline-none transition-[background-color,color,box-shadow,transform] duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:px-3 sm:text-sm",
                  isActive && "bg-card text-foreground shadow-sm",
                )}
              >
                <NavIcon name={item.icon} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ThemeSwitcher />
          <div
            className="hidden size-9 items-center justify-center rounded-xl bg-accent text-xs font-semibold text-accent-foreground shadow-sm sm:flex"
            aria-label="Tài khoản chủ nhà"
          >
            CN
          </div>
        </div>
      </div>
    </header>
  );
};

function NavIcon({ name }: { name: string }) {
  if (name === "rooms") {
    return (
      <span aria-hidden="true" className="text-base leading-none">
        ▦
      </span>
    );
  }

  if (name === "invoice") {
    return (
      <span aria-hidden="true" className="text-base leading-none">
        ▤
      </span>
    );
  }

  if (name === "tenants") {
    return (
      <span aria-hidden="true" className="text-base leading-none">
        ◎
      </span>
    );
  }

  if (name === "pricing") {
    return (
      <span aria-hidden="true" className="text-base leading-none">
        ₫
      </span>
    );
  }

  return (
    <span aria-hidden="true" className="text-base leading-none">
      ⌂
    </span>
  );
}
