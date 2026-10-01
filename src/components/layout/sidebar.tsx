import { primaryNav, secondaryNav } from "@/config/navigation";
import { Brand } from "@/components/layout/brand";
import { NavLinks } from "@/components/layout/nav-links";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

/** Fixed desktop sidebar. Hidden on small screens (see BottomNav). */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="flex h-16 items-center border-b px-6">
        <Brand />
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <NavLinks items={primaryNav} />
        <Separator className="my-4" />
        <NavLinks items={secondaryNav} />
      </ScrollArea>
      <div className="border-t p-4 text-xs text-muted-foreground">
        Data stored in your Google account
      </div>
    </aside>
  );
}
