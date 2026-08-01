"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency, revenueTrend } from "@/lib/demo-data";

const compactCurrency = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 1,
});

type TooltipEntry = {
  color?: string;
  dataKey?: string;
  value?: number | string;
};

function RevenueTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-52 rounded-2xl border border-white/60 bg-popover/90 p-3 text-sm shadow-xl backdrop-blur-xl dark:border-white/10">
      <p className="font-semibold">{label}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className={
                  entry.dataKey === "collected"
                    ? "size-2 rounded-full bg-chart-primary"
                    : "size-2 rounded-full bg-chart-secondary"
                }
              />
              {entry.dataKey === "collected" ? "Đã thu" : "Đã lập hóa đơn"}
            </span>
            <span className="font-mono font-semibold tabular-nums">
              {formatCurrency(Number(entry.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RevenueChart() {
  return (
    <div
      className="h-72 w-full sm:h-80"
      role="img"
      aria-label="Biểu đồ doanh thu đã lập hóa đơn và đã thu trong sáu tháng gần nhất"
    >
      <ResponsiveContainer width="100%" height="100%" debounce={120}>
        <AreaChart
          accessibilityLayer
          data={revenueTrend}
          margin={{ top: 16, right: 8, bottom: 0, left: -12 }}
        >
          <defs>
            <linearGradient id="billedRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-secondary)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--chart-secondary)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="collectedRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-primary)" stopOpacity={0.42} />
              <stop offset="100%" stopColor="var(--chart-primary)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--chart-grid)"
            strokeDasharray="4 6"
          />
          <XAxis
            axisLine={false}
            dataKey="period"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickLine={false}
            tickMargin={12}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(value) => compactCurrency.format(value)}
            tickLine={false}
            width={66}
          />
          <Tooltip
            content={<RevenueTooltip />}
            cursor={{ stroke: "var(--chart-grid)", strokeWidth: 1 }}
          />
          <Area
            dataKey="billed"
            fill="url(#billedRevenue)"
            fillOpacity={1}
            name="Đã lập hóa đơn"
            stroke="var(--chart-secondary)"
            strokeWidth={2}
            type="monotone"
          />
          <Area
            dataKey="collected"
            fill="url(#collectedRevenue)"
            fillOpacity={1}
            name="Đã thu"
            stroke="var(--chart-primary)"
            strokeWidth={3}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
