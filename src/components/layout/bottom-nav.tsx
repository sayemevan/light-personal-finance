"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  bottomNavHrefs,
  primaryNav,
  secondaryNav,
  type NavItem,
} from "@/config/navigation";
import { iconMap } from "@/components/layout/nav-links";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const allNav = [...primaryNav, ...secondaryNav];
const pinned = bottomNavHrefs
  .map((href) => allNav.find((item) => item.href === href))
  .filter((item): item is NavItem => Boolean(item));
const overflow = allNav.filter(
  (item) => !(bottomNavHrefs as readonly string[]).includes(item.href),
);

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Short labels so five destinations fit a phone-width bar. */
const shortTitle: Record<string, string> = { "/dashboard": "Home" };

function NavDestination({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <>
      <span
        className={cn(
          "flex h-8 w-16 items-center justify-center rounded-full transition-colors duration-200",
          active ? "bg-primary/15 text-primary" : "text-muted-foreground",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span
        className={cn(
          "text-[11px] leading-none",
          active ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </>
  );
}

/**
 * Material-style bottom navigation bar for phones. The four most used
 * destinations are pinned; everything else opens from "More" as a sheet.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const overflowActive = overflow.some((item) => isActive(pathname, item.href));

  // Close "More" once the route changes. Its links use `replace`, which swaps
  // out the history entry the open sheet pushed, so Back still goes to the
  // previous page rather than reopening the sheet.
  React.useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      >
        <div className="mx-auto flex h-16 max-w-lg items-stretch">
          {pinned.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-1 select-none flex-col items-center justify-center gap-1"
              >
                <NavDestination
                  icon={iconMap[item.icon]}
                  label={shortTitle[item.href] ?? item.title}
                  active={active}
                />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className="flex flex-1 select-none flex-col items-center justify-center gap-1"
          >
            <NavDestination
              icon={Menu}
              label="More"
              active={overflowActive || moreOpen}
            />
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader className="text-left">
            <SheetTitle>More</SheetTitle>
            <SheetDescription className="sr-only">
              Other sections of the app
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {overflow.map((item) => {
              const Icon = iconMap[item.icon];
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  replace
                  onClick={() => active && setMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center text-xs font-medium transition-colors active:bg-accent",
                    active && "bg-primary/10 text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-2xl",
                      active ? "bg-primary/15" : "bg-muted",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {item.title}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
