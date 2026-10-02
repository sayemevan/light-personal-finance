"use client";

// TEMPORARY: find which way of leaving the installed app actually opens a
// Chrome tab on the user's phone. Delete once DesktopModeNotice uses the winner.

import * as React from "react";

import { PageHeader } from "@/components/shared/page-header";

interface Attempt {
  id: string;
  label: string;
  run: (url: URL) => void;
}

function go(href: string) {
  window.location.href = href;
}

function intent(url: URL, extras: string) {
  return (
    `intent://${url.host}${url.pathname}${url.search}#Intent;` +
    `scheme=${url.protocol.replace(":", "")};${extras}end`
  );
}

const attempts: Attempt[] = [
  {
    id: "1",
    label: "Intent to Chrome (the old button)",
    run: (url) =>
      go(intent(url, "package=com.android.chrome;")),
  },
  {
    id: "2",
    label: "Intent to Chrome, new task",
    run: (url) =>
      go(
        intent(
          url,
          "action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.android.chrome;launchFlags=0x10000000;",
        ),
      ),
  },
  {
    id: "3",
    label: "googlechrome:// link",
    run: (url) =>
      go(`googlechrome://navigate?url=${encodeURIComponent(url.href)}`),
  },
  {
    id: "4",
    label: "Intent to Chrome's main screen",
    run: (url) =>
      go(
        intent(
          url,
          "action=android.intent.action.VIEW;component=com.android.chrome/com.google.android.apps.chrome.Main;",
        ),
      ),
  },
  {
    id: "5",
    label: "New window (window.open)",
    run: (url) => {
      window.open(url.href, "_blank", "noopener");
    },
  },
  {
    id: "6",
    label: "Plain link with target=_blank",
    run: () => undefined, // rendered as a real <a> below
  },
];

export default function OpenInChromeTestPage() {
  const [target, setTarget] = React.useState<URL | null>(null);

  React.useEffect(() => {
    // Each attempt adds ?via=<id>, so the address bar shows which one landed.
    setTarget(new URL("/dashboard", window.location.origin));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Open in Chrome test"
        description="Run this inside the installed app. Tap each button, note whether a real Chrome tab (with an address bar and ⋮ menu) opened, then come back here."
      />
      {target ? (
        <ol className="space-y-3">
          {attempts.map((attempt) => {
            const withMarker = new URL(target);
            withMarker.searchParams.set("via", attempt.id);
            return (
              <li key={attempt.id}>
                {attempt.id === "6" ? (
                  <a
                    href={withMarker.href}
                    target="_blank"
                    rel="noopener"
                    className="flex h-14 w-full items-center rounded-lg border px-4 text-base font-medium active:bg-accent"
                  >
                    {attempt.id}. {attempt.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => attempt.run(withMarker)}
                    className="flex h-14 w-full items-center rounded-lg border px-4 text-left text-base font-medium active:bg-accent"
                  >
                    {attempt.id}. {attempt.label}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
