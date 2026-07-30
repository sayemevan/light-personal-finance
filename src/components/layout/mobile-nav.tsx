"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import { primaryNav, secondaryNav } from "@/config/navigation";
import { Brand } from "@/components/layout/brand";
import { NavLinks } from "@/components/layout/nav-links";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Slide-in navigation drawer for small screens. */
export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="h-16 justify-center border-b px-6 text-left">
          <SheetTitle asChild>
            <Brand />
          </SheetTitle>
        </SheetHeader>
        <div className="px-3 py-4">
          <NavLinks items={primaryNav} onNavigate={close} />
          <Separator className="my-4" />
          <NavLinks items={secondaryNav} onNavigate={close} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
