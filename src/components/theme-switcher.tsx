"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const themeLabels = {
  system: "Hệ thống",
  light: "Sáng",
  dark: "Tối",
};

const subscribeToHydration = () => () => undefined;

export function ThemeSwitcher() {
  const mounted = React.useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const { theme, setTheme } = useTheme();

  if (!mounted) {
    return <Skeleton aria-label="Đang tải tùy chọn giao diện" className="h-10 w-32 rounded-xl" />;
  }

  return (
    <Select value={theme} onValueChange={setTheme}>
      <SelectTrigger
        aria-label="Chọn giao diện sáng hoặc tối"
        className="w-32 border-white/60 bg-card/55 dark:border-white/10"
      >
        <span aria-hidden="true" className="text-base leading-none">
          ◐
        </span>
        <SelectValue placeholder="Giao diện">
          {themeLabels[theme as keyof typeof themeLabels] ?? "Giao diện"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="system">Hệ thống</SelectItem>
        <SelectItem value="light">Sáng</SelectItem>
        <SelectItem value="dark">Tối</SelectItem>
      </SelectContent>
    </Select>
  );
}
