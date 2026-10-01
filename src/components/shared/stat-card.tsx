import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
}

/** Compact KPI card used across the dashboard. */
export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  className,
}: StatCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-4 pb-1 sm:items-center sm:p-6 sm:pb-2">
        <CardTitle className="text-xs font-medium leading-snug text-muted-foreground sm:text-sm">
          {title}
        </CardTitle>
        {Icon ? (
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : null}
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="break-words text-lg font-semibold tracking-tight sm:text-2xl">
          {value}
        </div>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
