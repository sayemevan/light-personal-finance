import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppBarTitle } from "@/components/layout/app-bar-title";
import { UserNav } from "@/components/layout/user-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

/**
 * Top bar shown on every authenticated page. On phones it doubles as the
 * native-style app bar, titled with the current section.
 */
export function Header({ user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 pt-safe backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center gap-2 px-4 md:h-16 md:px-6">
        <AppBarTitle />
        <div className="flex-1" />
        <Button asChild size="sm" className="hidden md:inline-flex">
          <Link href="/expenses?new=1">
            <Plus className="h-4 w-4" />
            Add expense
          </Link>
        </Button>
        <ThemeToggle />
        <UserNav name={user.name} email={user.email} image={user.image} />
      </div>
    </header>
  );
}
