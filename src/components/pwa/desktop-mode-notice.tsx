"use client";

import * as React from "react";
import { Check, Copy, MonitorSmartphone, X } from "lucide-react";

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

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shown in the installed app when Chrome's "Desktop site" is on for this
 * site. The app can't change that setting, and links to the site from here
 * (even intents aimed at Chrome) open back in the app. A URL typed into
 * Chrome's address bar stays in Chrome, so hand over the link to paste.
 */
export function DesktopModeNotice() {
  const [state, setState] = React.useState<DesktopModeState | null>(null);
  const [copied, setCopied] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (isDismissed()) return;
    const update = () => setState(detectDesktopMode());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!state) return null;

  const siteUrl = `${window.location.origin}/dashboard`;

  const copyLink = async () => setCopied(await copyText(siteUrl));

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
          <ol className="list-decimal space-y-1 pl-5 text-amber-900 dark:text-amber-200">
            <li>Copy the link below.</li>
            <li>
              Open the <span className="font-medium">Chrome</span> app and
              paste it into the address bar.
            </li>
            <li>
              Untick <span className="font-medium">⋮ → Desktop site</span>.
            </li>
            <li>Come back to this app.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-amber-500 px-4 text-sm font-medium text-amber-950 hover:bg-amber-400"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copied ? "Link copied" : "Copy link"}
            </button>
            {/* Shown always so it can be copied by hand if the clipboard is blocked. */}
            <span className="select-all break-all font-mono text-xs">
              {siteUrl}
            </span>
          </div>
          {copied === false ? (
            <p className="text-xs">
              Couldn&apos;t copy automatically — press and hold the link to
              copy it.
            </p>
          ) : null}
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
