"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatCurrency } from "@/lib/format";

export interface CategoryDatum {
  name: string;
  total: number;
}

const PALETTE = [
  "hsl(142 71% 45%)",
  "hsl(217 91% 60%)",
  "hsl(37 92% 50%)",
  "hsl(0 72% 51%)",
  "hsl(280 65% 60%)",
  "hsl(190 80% 42%)",
  "hsl(330 75% 55%)",
  "hsl(50 92% 50%)",
];

interface CategoryDonutProps {
  data: CategoryDatum[];
  currency?: string;
}

/** Donut chart of totals by category. */
export function CategoryDonut({ data, currency = "USD" }: CategoryDonutProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
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
        <Pie
          data={data}
          dataKey="total"
          nameKey="name"
          innerRadius={64}
          outerRadius={104}
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell
              key={entry.name}
              fill={PALETTE[index % PALETTE.length]}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
