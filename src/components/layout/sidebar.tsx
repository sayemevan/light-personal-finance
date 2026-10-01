"use client";

import * as React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { primaryNav, secondaryNav } from "@/config/navigation";
import { Brand } from "@/components/layout/brand";
import { NavLinks } from "@/components/layout/nav-links";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Read by the dashboard layout so the first paint already has the right width. */
export const SIDEBAR_COOKIE = "pf-sidebar-collapsed";

function persist(collapsed: boolean) {
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Desktop sidebar that collapses to an icon rail (toggle button or Ctrl/⌘+B).
 * Hidden on small screens (see BottomNav).
 */
export function Sidebar({ defaultCollapsed = false }: { defaultCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const toggle = React.useCallback(() => {
    setCollapsed((value) => {
      persist(!value);
      return !value;
    });
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const toggleButton = (
    <button
      type="button"
      onClick={toggle}
      aria-label={toggleLabel}
      aria-expanded={!collapsed}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <ToggleIcon className="h-4 w-4 shrink-0" />
      {collapsed ? null : <span className="truncate">Collapse</span>}
    </button>
  );

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r bg-card transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b",
          collapsed ? "justify-center px-2" : "px-6",
        )}
      >
        <Brand iconOnly={collapsed} />
      </div>
      <ScrollArea className={cn("min-h-0 flex-1 py-4", collapsed ? "px-2" : "px-3")}>
        <NavLinks items={primaryNav} collapsed={collapsed} />
        <Separator className="my-4" />
        <NavLinks items={secondaryNav} collapsed={collapsed} />
      </ScrollArea>
      <div className={cn("shrink-0 border-t", collapsed ? "p-2" : "p-3")}>
        {collapsed ? null : (
          <p className="px-3 pb-2 text-xs text-muted-foreground">
            Data stored in your Google account
          </p>
        )}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{toggleButton}</TooltipTrigger>
            <TooltipContent side="right">{toggleLabel}</TooltipContent>
          </Tooltip>
        ) : (
          toggleButton
        )}
      </div>
    </aside>
  );
}
