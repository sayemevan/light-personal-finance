import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/shared/table-skeleton";

export default function ExpensesLoading() {
  return (
    <div className="space-y-6">
      <div className="hidden items-center justify-between md:flex">
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
