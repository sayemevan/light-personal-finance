import * as React from "react";
import { Plus, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/shared/fab";

interface PageHeaderProps {
  title: string;
  description?: string;
  /**
   * The page's primary "create" action. Rendered as a header button on larger
   * screens and as a floating action button on phones.
   */
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
  /** Optional extra control(s) rendered on the right on every screen size. */
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  actions,
  className,
}: PageHeaderProps) {
  const ActionIcon = action?.icon ?? Plus;
  return (
    <>
      <div
        className={cn(
          // On phones the app bar already shows the title.
          "flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between",
          actions ? "flex" : "hidden md:flex",
          className,
        )}
      >
        <div className="hidden space-y-1 md:block">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action || actions ? (
          <div className="flex items-center gap-2">
            {actions}
            {action ? (
              <Button onClick={action.onClick} className="hidden md:inline-flex">
                <ActionIcon className="h-4 w-4" />
                {action.label}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {action ? (
        <Fab label={action.label} onClick={action.onClick} icon={action.icon} />
      ) : null}
    </>
  );
}
