import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/shared/table-skeleton";

/**
 * Generic fallback for dashboard-group routes that don't define their own
 * `loading.tsx`. Mirrors the common "page header + table" layout.
 */
export default function DashboardGroupLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <TableSkeleton />
    </div>
  );
}
