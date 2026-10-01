"use client";

import * as React from "react";
import { Sankey, Tooltip } from "recharts";

import { formatCurrency } from "@/lib/format";
import type { CashFlowReport } from "@/types/reports";

/** Theme-aware colours (CSS variables follow the `dark` class on <html>). */
export const FLOW_COLORS = {
  income: "hsl(var(--primary))",
  saved: "hsl(var(--primary))",
  fromSavings: "hsl(37 92% 50%)",
  hub: "hsl(var(--foreground))",
};

export interface FlowNode {
  name: string;
  color: string;
  /** 0 = sources, 1 = the "Income" hub, 2 = destinations. */
  column: 0 | 1 | 2;
}

/** Build Sankey nodes/links: sources → "Income" → expense categories/Saved. */
export function buildFlow(report: CashFlowReport, expenseColors: string[]) {
  const nodes: FlowNode[] = [];
  const links: { source: number; target: number; value: number }[] = [];

  const sources = report.income.map((item) => ({
    name: item.name,
    value: item.total,
    color: FLOW_COLORS.income,
  }));
  if (report.fromSavings > 0) {
    sources.push({
      name: "From savings",
      value: report.fromSavings,
      color: FLOW_COLORS.fromSavings,
    });
  }
  const destinations = report.expense.map((item, index) => ({
    name: item.name,
    value: item.total,
    color: expenseColors[index % expenseColors.length] ?? FLOW_COLORS.hub,
  }));
  if (report.saved > 0) {
    destinations.push({
      name: "Saved",
      value: report.saved,
      color: FLOW_COLORS.saved,
    });
  }

  for (const source of sources) {
    nodes.push({ name: source.name, color: source.color, column: 0 });
  }
  const hub = nodes.length;
  nodes.push({ name: "Income", color: FLOW_COLORS.hub, column: 1 });
  sources.forEach((source, index) =>
    links.push({ source: index, target: hub, value: source.value }),
  );
  for (const destination of destinations) {
    links.push({ source: hub, target: nodes.length, value: destination.value });
    nodes.push({ name: destination.name, color: destination.color, column: 2 });
  }
  return { nodes, links, rows: Math.max(sources.length, destinations.length) };
}

const LABEL_SPACE = 118;

function truncate(text: string, max = 16): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

interface NodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: FlowNode & { value: number };
}

interface LinkProps {
  sourceX: number;
  targetX: number;
  sourceY: number;
  targetY: number;
  sourceControlX: number;
  targetControlX: number;
  linkWidth: number;
  payload: {
    source: FlowNode;
    target: FlowNode;
    value: number;
  };
}

interface CashFlowSankeyProps {
  report: CashFlowReport;
  width: number;
  currency: string;
  expenseColors: string[];
}

/** Income → expense flow diagram. Needs ≥ ~480px of width to stay legible. */
export function CashFlowSankey({
  report,
  width,
  currency,
  expenseColors,
}: CashFlowSankeyProps) {
  const { nodes, links, rows } = React.useMemo(
    () => buildFlow(report, expenseColors),
    [report, expenseColors],
  );
  const height = Math.max(280, rows * 44);
  const compact = (value: number) =>
    new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);

  const renderNode = (props: NodeProps) => {
    const { x, y, width: w, height: h, payload } = props;
    const left = payload.column === 0;
    const hub = payload.column === 1;
    const labelX = hub ? x + w / 2 : left ? x - 8 : x + w + 8;
    const anchor = hub ? "middle" : left ? "end" : "start";
    const labelY = hub ? y - 8 : y + h / 2;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={w}
          height={Math.max(h, 1)}
          rx={2}
          fill={payload.color}
          fillOpacity={hub ? 0.85 : 1}
        />
        <text
          x={labelX}
          y={labelY}
          textAnchor={anchor}
          dominantBaseline={hub ? "auto" : "middle"}
          fontSize={12}
          fill="hsl(var(--foreground))"
        >
          {truncate(payload.name)}
          {hub ? null : (
            <tspan fill="hsl(var(--muted-foreground))" dx={4}>
              {compact(payload.value)}
            </tspan>
          )}
        </text>
      </g>
    );
  };

  const renderLink = (props: LinkProps) => {
    const {
      sourceX,
      targetX,
      sourceY,
      targetY,
      sourceControlX,
      targetControlX,
      linkWidth,
      payload,
    } = props;
    // Colour each band by its non-hub end so categories stay identifiable.
    const color =
      payload.source.column === 0 ? payload.source.color : payload.target.color;
    return (
      <path
        d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none"
        stroke={color}
        strokeOpacity={0.3}
        strokeWidth={Math.max(linkWidth, 1)}
      />
    );
  };

  return (
    <Sankey
      width={width}
      height={height}
      data={{ nodes, links }}
      nodeWidth={10}
      nodePadding={14}
      linkCurvature={0.5}
      iterations={0}
      sort={false}
      margin={{ top: 24, right: LABEL_SPACE, bottom: 8, left: LABEL_SPACE }}
      node={renderNode}
      link={renderLink}
    >
      <Tooltip
        contentStyle={{
          background: "hsl(var(--popover))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 8,
          fontSize: 12,
          color: "hsl(var(--popover-foreground))",
        }}
        formatter={(value: number) => formatCurrency(value, currency)}
      />
    </Sankey>
  );
}
