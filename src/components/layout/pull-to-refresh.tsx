"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

const TRIGGER = 72;
const MAX_PULL = 120;

/**
 * Android-style pull-to-refresh for phones: dragging down from the top of the
 * page reveals a spinner, and releasing past the threshold refetches every
 * query on screen. The browser's own pull-to-refresh is disabled in CSS
 * (overscroll-behavior), so this replaces it with an in-app version.
 */
export function PullToRefresh() {
  const queryClient = useQueryClient();
  const [pull, setPull] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const pullRef = React.useRef(0);
  const refreshingRef = React.useRef(false);

  React.useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const blocked = (target: EventTarget | null) =>
      // Ignore drags inside overlays (sheets, dialogs, menus) and scrollers.
      target instanceof Element &&
      Boolean(
        target.closest(
          '[role="dialog"],[role="menu"],[role="listbox"],[data-no-ptr]',
        ),
      );

    const onStart = (event: TouchEvent) => {
      if (window.scrollY > 0 || refreshingRef.current || blocked(event.target)) {
        start.current = null;
        return;
      }
      const touch = event.touches[0];
      start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    };

    const onMove = (event: TouchEvent) => {
      const origin = start.current;
      const touch = event.touches[0];
      if (!origin || !touch) return;
      const dy = touch.clientY - origin.y;
      const dx = Math.abs(touch.clientX - origin.x);
      if (dy <= 0 || dx > dy || window.scrollY > 0) {
        if (pullRef.current) set(0);
        return;
      }
      // Resistance so it feels elastic rather than 1:1.
      set(Math.min(MAX_PULL, dy * 0.5));
    };

    const onEnd = () => {
      start.current = null;
      if (pullRef.current >= TRIGGER) {
        refreshingRef.current = true;
        setRefreshing(true);
        set(TRIGGER * 0.75);
        void queryClient
          .refetchQueries({ type: "active" })
          .finally(() => {
            refreshingRef.current = false;
            setRefreshing(false);
            set(0);
          });
      } else {
        set(0);
      }
    };

    const set = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [queryClient]);

  const progress = Math.min(1, pull / TRIGGER);

  if (pull === 0 && !refreshing) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-20 flex justify-center md:hidden"
      style={{
        transform: `translateY(${pull - 24}px)`,
        transition: start.current ? "none" : "transform 200ms ease-out",
      }}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-md">
        <RefreshCw
          className={cn(
            "h-5 w-5 text-primary",
            refreshing && "animate-spin",
          )}
          style={
            refreshing
              ? undefined
              : { transform: `rotate(${progress * 270}deg)`, opacity: 0.4 + progress * 0.6 }
          }
          aria-hidden="true"
        />
        <span className="sr-only">{refreshing ? "Refreshing" : "Pull to refresh"}</span>
      </span>
    </div>
  );
}
