"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Wallet,
  Tags,
  HandCoins,
  LineChart,
  Boxes,
  BarChart3,
  Settings,
  PieChart,
  Repeat,
  Target,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavIcon, NavItem } from "@/config/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Resolves serializable icon names from the nav config to Lucide components. */
export const iconMap: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  expenses: Receipt,
  income: TrendingUp,
  accounts: Wallet,
  categories: Tags,
  loans: HandCoins,
  investments: LineChart,
  assets: Boxes,
  reports: BarChart3,
  budgets: PieChart,
  goals: Target,
  recurring: Repeat,
  settings: Settings,
};

interface NavLinksProps {
  items: NavItem[];
  /** Called after a link is clicked (e.g. to close the mobile drawer). */
  onNavigate?: () => void;
  /** Icon-only rail; labels move into tooltips. */
  collapsed?: boolean;
}

export function NavLinks({ items, onNavigate, collapsed = false }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-1 gap-1">
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = iconMap[item.icon];
        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            aria-label={collapsed ? item.title : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              collapsed && "justify-center px-0",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {collapsed ? null : <span className="truncate">{item.title}</span>}
          </Link>
        );
        if (!collapsed) return link;
        return (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{item.title}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
