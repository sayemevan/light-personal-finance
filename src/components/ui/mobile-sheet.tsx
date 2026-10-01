"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const MOBILE_QUERY = "(max-width: 767px)";
const DEPTH_KEY = "__sheetDepth";

function isMobile() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;
}

function historyDepth(): number {
  const state = window.history.state as Record<string, unknown> | null;
  return typeof state?.[DEPTH_KEY] === "number" ? (state[DEPTH_KEY] as number) : 0;
}

/**
 * Makes the Android back button / gesture close an open overlay instead of
 * leaving the page, the way native bottom sheets and dialogs behave. Each open
 * overlay pushes a same-URL history entry tagged with its stacking depth, so
 * nested overlays (a confirm on top of a sheet) close one at a time.
 */
export function useBackToClose(
  close: () => void,
  contentRef: React.RefObject<HTMLElement | null>,
) {
  const closeRef = React.useRef(close);
  closeRef.current = close;

  React.useEffect(() => {
    if (!isMobile()) return;
    let depth = 0;
    const dropEntry = () => {
      // Closed by other means (Cancel, overlay tap, swipe): drop our entry.
      if (depth && historyDepth() === depth) window.history.back();
      depth = 0;
    };

    // Deferred so React's dev double-mount doesn't push twice.
    const timer = window.setTimeout(() => {
      depth = historyDepth() + 1;
      window.history.pushState(
        { ...(window.history.state ?? {}), [DEPTH_KEY]: depth },
        "",
      );
    }, 0);

    const onPopState = () => {
      if (depth && historyDepth() < depth) {
        depth = 0;
        closeRef.current();
      }
    };
    window.addEventListener("popstate", onPopState);

    // Radix keeps the content mounted through its exit animation, so react to
    // `data-state="closed"` instead of waiting for unmount.
    const observer = new MutationObserver(() => {
      if (contentRef.current?.dataset.state === "closed") dropEntry();
    });
    if (contentRef.current) {
      observer.observe(contentRef.current, {
        attributes: true,
        attributeFilter: ["data-state"],
      });
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", onPopState);
      observer.disconnect();
      dropEntry();
    };
  }, [contentRef]);
}

/**
 * Grab handle for a bottom sheet. Dragging it moves `targetRef` with the
 * finger; releasing far or fast enough dismisses the sheet.
 */
export function SheetGrabber({
  targetRef,
  onDismiss,
  className,
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
  className?: string;
}) {
  const drag = React.useRef<{ y: number; t: number; dy: number } | null>(null);

  const setOffset = (dy: number, animate: boolean) => {
    const el = targetRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform 200ms ease-out" : "none";
    el.style.transform = dy ? `translateY(${dy}px)` : "";
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        "-mx-5 -mt-2 flex h-7 shrink-0 cursor-grab touch-none items-center justify-center sm:hidden",
        className,
      )}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { y: event.clientY, t: event.timeStamp, dy: 0 };
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const dy = Math.max(0, event.clientY - drag.current.y);
        drag.current.dy = dy;
        setOffset(dy, false);
      }}
      onPointerUp={(event) => {
        const state = drag.current;
        drag.current = null;
        if (!state) return;
        const velocity = state.dy / Math.max(1, event.timeStamp - state.t);
        const height = targetRef.current?.offsetHeight ?? 400;
        if (state.dy > Math.min(140, height * 0.3) || velocity > 0.6) {
          onDismiss();
        } else {
          setOffset(0, true);
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
        setOffset(0, true);
      }}
    >
      <span className="h-1 w-8 rounded-full bg-muted-foreground/40" />
    </div>
  );
}
