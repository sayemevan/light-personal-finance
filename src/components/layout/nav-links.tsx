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
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { NavIcon, NavItem } from "@/config/navigation";

/** Resolves serializable icon names from the nav config to Lucide components. */
const iconMap: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  expenses: Receipt,
  income: TrendingUp,
  accounts: Wallet,
  categories: Tags,
  loans: HandCoins,
  investments: LineChart,
  assets: Boxes,
  reports: BarChart3,
  settings: Settings,
};

interface NavLinksProps {
  items: NavItem[];
  /** Called after a link is clicked (e.g. to close the mobile drawer). */
  onNavigate?: () => void;
}

export function NavLinks({ items, onNavigate }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1">
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = iconMap[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
