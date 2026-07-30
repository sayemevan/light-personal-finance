import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserNav } from "@/components/layout/user-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

/** Top bar shown on every authenticated page. */
export function Header({ user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <MobileNav />
      <div className="flex-1" />
      <Button asChild size="sm" className="hidden sm:inline-flex">
        <Link href="/expenses">
          <Plus className="h-4 w-4" />
          Add expense
        </Link>
      </Button>
      <ThemeToggle />
      <UserNav name={user.name} email={user.email} image={user.image} />
    </header>
  );
}
