"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthlyPoint } from "@/types/domain";
import { formatCurrency } from "@/lib/format";

interface MonthlyChartProps {
  data: MonthlyPoint[];
  currency?: string;
}

function shortMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short" });
}

/** Grouped bar chart comparing monthly income and expense. */
export function MonthlyChart({ data, currency = "USD" }: MonthlyChartProps) {
  const chartData = data.map((point) => ({
    ...point,
    label: shortMonth(point.month),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          className="text-xs"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          className="text-xs"
          tickFormatter={(value: number) =>
            new Intl.NumberFormat("en-US", { notation: "compact" }).format(value)
          }
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number, name) => [
            formatCurrency(value, currency),
            name === "income" ? "Income" : "Expense",
          ]}
        />
        <Bar dataKey="income" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
