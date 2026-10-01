"use client";

import * as React from "react";
import { Plus, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface FabProps {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  className?: string;
}

/**
 * Material-style extended floating action button for phones. It sits above
 * the bottom nav and collapses to an icon while the user scrolls down.
 */
export function Fab({ label, onClick, icon: Icon = Plus, className }: FabProps) {
  const [extended, setExtended] = React.useState(true);

  React.useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) < 8) return;
      setExtended(y < lastY || y < 24);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 min-w-14 select-none items-center justify-center rounded-2xl bg-primary px-4 text-primary-foreground shadow-lg shadow-primary/30 transition-[transform,box-shadow] duration-200 active:scale-95 active:shadow-md md:hidden",
        className,
      )}
    >
      <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
      {/* A 0fr → 1fr grid track animates the label's real width, so the
          button collapses to a 56px square without lag or leftover gap. */}
      <span
        aria-hidden="true"
        className="grid transition-[grid-template-columns,opacity] duration-200 ease-out"
        style={{
          gridTemplateColumns: extended ? "1fr" : "0fr",
          opacity: extended ? 1 : 0,
        }}
      >
        <span className="overflow-hidden whitespace-nowrap">
          <span className="block pl-2 pr-1 text-sm font-semibold">{label}</span>
        </span>
      </span>
    </button>
  );
}
