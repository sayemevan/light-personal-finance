"use client";

import { usePathname } from "next/navigation";

import { siteConfig } from "@/config/site";
import { findNavItem } from "@/config/navigation";

/** Current section name shown in the mobile top app bar. */
export function AppBarTitle() {
  const pathname = usePathname();
  const title = findNavItem(pathname)?.title ?? siteConfig.name;
  return (
    <h1 className="truncate text-xl font-semibold tracking-tight md:hidden">
      {title}
    </h1>
  );
}
