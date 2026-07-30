"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatCurrency } from "@/lib/format";

export interface AllocationSlice {
  name: string;
  value: number;
  color: string;
}

interface AllocationChartProps {
  data: AllocationSlice[];
  currency?: string;
}

/** Donut chart showing how net worth is split across cash, investments, assets. */
export function AllocationChart({ data, currency = "USD" }: AllocationChartProps) {
  const slices = data.filter((slice) => slice.value > 0);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (total <= 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        Add cash, investments or assets to see your allocation.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ResponsiveContainer width="100%" height={240} className="max-w-[240px]">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            stroke="none"
          >
            {slices.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, name) => [
              formatCurrency(value, currency),
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      <ul className="w-full space-y-2">
        {slices.map((slice) => {
          const pct = total > 0 ? (slice.value / total) * 100 : 0;
          return (
            <li
              key={slice.name}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: slice.color }}
                />
                {slice.name}
              </span>
              <span className="text-muted-foreground">
                {formatCurrency(slice.value, currency)} · {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
