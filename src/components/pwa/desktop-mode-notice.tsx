"use client";

import * as React from "react";
import { MonitorSmartphone, X } from "lucide-react";

const DISMISSED_FLAG = "pf:desktop-mode-notice-dismissed";

interface DesktopModeState {
  /** How far the browser zoomed the page out to fit its desktop-width layout. */
  scale: number;
}

function isDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISSED_FLAG) === "1";
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    window.sessionStorage.setItem(DISMISSED_FLAG, "1");
  } catch {
    // Storage blocked — the notice just comes back on the next load.
  }
}

/**
 * Chrome's "Desktop site" setting is per site and installed apps share it.
 * With it on, Chrome ignores the viewport meta tag and lays the page out
 * ~980px wide, zoomed out to fit a phone. Detect that inside the installed
 * app on a touch screen.
 */
function detectDesktopMode(): DesktopModeState | null {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches;
  const touch =
    navigator.maxTouchPoints > 0 &&
    window.matchMedia("(pointer: coarse)").matches;
  if (!standalone || !touch) return null;

  const widerThanScreen =
    window.screen.width > 0 && window.innerWidth > window.screen.width * 1.25;
  const zoomedOut = (window.visualViewport?.scale ?? 1) < 0.8;
  if (!widerThanScreen && !zoomedOut) return null;

  const scale = zoomedOut
    ? window.visualViewport!.scale
    : window.screen.width / window.innerWidth;
  return { scale };
}

/** An Android intent link that opens the current page in Chrome, not the app. */
function chromeIntentUrl(): string {
  const { host, pathname, search, protocol, href } = window.location;
  return (
    `intent://${host}${pathname}${search}#Intent;` +
    `scheme=${protocol.replace(":", "")};package=com.android.chrome;` +
    `S.browser_fallback_url=${encodeURIComponent(href)};end`
  );
}

/**
 * Shown in the installed app when Chrome's "Desktop site" is on for this
 * site. The app can't change that setting, so this links to Chrome where the
 * user can untick it.
 */
export function DesktopModeNotice() {
  const [state, setState] = React.useState<DesktopModeState | null>(null);

  React.useEffect(() => {
    if (isDismissed()) return;
    const update = () => setState(detectDesktopMode());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!state) return null;

  const dismiss = () => {
    markDismissed();
    setState(null);
  };

  return (
    <div
      role="status"
      // The page is zoomed out to fit a desktop layout; zoom just this
      // notice back up so it reads at normal phone size.
      style={{ zoom: Math.min(1 / state.scale, 4) }}
      className="border-b bg-amber-50 px-4 py-3 text-amber-950 dark:bg-amber-950 dark:text-amber-50"
    >
      <div className="flex items-start gap-3">
        <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <p className="font-medium">Desktop site is on</p>
          <p className="text-amber-900 dark:text-amber-200">
            Chrome is showing the desktop layout. Open this page in Chrome,
            untick <span className="font-medium">⋮ → Desktop site</span>, then
            come back to the app.
          </p>
          <a
            href="#"
            // Built on tap so it points at the page the user is on now.
            onClick={(event) => {
              event.currentTarget.href = chromeIntentUrl();
            }}
            className="inline-flex h-9 items-center rounded-md bg-amber-500 px-4 text-sm font-medium text-amber-950 hover:bg-amber-400"
          >
            Open in Chrome
          </a>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-m-1 rounded-md p-1 hover:bg-amber-100 dark:hover:bg-amber-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
