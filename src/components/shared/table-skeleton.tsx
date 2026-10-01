import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder shaped like the content it stands in for: a table on
 * larger screens, and search bar + filter chips + two-line list rows on phones.
 */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="space-y-3 md:hidden">
        <Skeleton className="h-11 w-full rounded-full" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
        <div className="divide-y overflow-hidden rounded-2xl border">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="hidden space-y-3 rounded-xl border p-4 md:block">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
