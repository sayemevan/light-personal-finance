import Link from "next/link";
import { Wallet } from "lucide-react";

import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";

export function Brand({
  className,
  iconOnly = false,
}: {
  className?: string;
  /** Show just the logo mark (collapsed sidebar). */
  iconOnly?: boolean;
}) {
  return (
    <Link
      href="/dashboard"
      aria-label={iconOnly ? siteConfig.name : undefined}
      className={cn("flex items-center gap-2 font-semibold", className)}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wallet className="h-4 w-4" />
      </span>
      {iconOnly ? null : (
        <span className="text-base tracking-tight">{siteConfig.name}</span>
      )}
    </Link>
  );
}
