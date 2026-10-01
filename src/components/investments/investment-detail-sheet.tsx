"use client";

import * as React from "react";
import { Trash2, TrendingDown, TrendingUp } from "lucide-react";

import {
  useInvestment,
  useDeleteInvestmentTransaction,
} from "@/hooks/use-investments";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency, formatDate } from "@/lib/format";
import { INVESTMENT_TYPE_LABELS } from "@/lib/labels";
import type { InvestmentTransactionDirection } from "@/types/domain";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { InvestmentTransactionFormDialog } from "@/components/forms/investment-transaction-form-dialog";

interface InvestmentDetailSheetProps {
  investmentId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HISTORY_PAGE_SIZE = 8;

export function InvestmentDetailSheet({
  investmentId,
  open,
  onOpenChange,
}: InvestmentDetailSheetProps) {
  const investmentQuery = useInvestment(open ? investmentId : undefined);
  const deleteTransaction = useDeleteInvestmentTransaction();
  const { accountName } = useLookups();
  const currency = useCurrency();
  const [formOpen, setFormOpen] = React.useState(false);
  const [direction, setDirection] =
    React.useState<InvestmentTransactionDirection>("income");
  const [visibleCount, setVisibleCount] = React.useState(HISTORY_PAGE_SIZE);

  React.useEffect(() => {
    setVisibleCount(HISTORY_PAGE_SIZE);
  }, [investmentId, open]);

  const investment = investmentQuery.data;
  const visibleTransactions =
    investment?.transactions.slice(0, visibleCount) ?? [];

  const openForm = (next: InvestmentTransactionDirection) => {
    setDirection(next);
    setFormOpen(true);
  };

  const totalIncome =
    investment?.transactions
      .filter((t) => t.direction === "income")
      .reduce((sum, t) => sum + t.amount, 0) ?? 0;
  const totalLoss =
    investment?.transactions
      .filter((t) => t.direction === "loss")
      .reduce((sum, t) => sum + t.amount, 0) ?? 0;
  const gain = investment?.gain ?? 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto border-l-0 sm:max-w-md sm:border-l">
          {investmentQuery.isLoading || !investment ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {investment.name}
                  <Badge variant="secondary">
                    {INVESTMENT_TYPE_LABELS[investment.type]}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  Purchased {formatDate(investment.purchaseDate)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Invested</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(investment.amountInvested, currency)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Current value</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(investment.currentValue, currency)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Gain / loss</p>
                  <p
                    className={cn(
                      "text-lg font-semibold",
                      gain > 0 && "text-emerald-600 dark:text-emerald-400",
                      gain < 0 && "text-red-600 dark:text-red-400",
                    )}
                  >
                    {gain > 0 ? "+" : ""}
                    {formatCurrency(gain, currency)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Income earned</p>
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(totalIncome, currency)}
                  </p>
                </div>
              </div>

              {investment.accountId ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Paid from: {accountName(investment.accountId)}
                </p>
              ) : null}
              {totalLoss > 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Recorded losses: {formatCurrency(totalLoss, currency)}
                </p>
              ) : null}
              {investment.notes ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {investment.notes}
                </p>
              ) : null}

              <Separator className="my-4" />

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Income & losses</h3>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => openForm("income")}>
                    <TrendingUp className="h-4 w-4" />
                    Income
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openForm("loss")}
                  >
                    <TrendingDown className="h-4 w-4" />
                    Loss
                  </Button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {investment.transactions.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No income or losses recorded yet.
                  </p>
                ) : (
                  visibleTransactions.map((transaction) => {
                    const isIncome = transaction.direction === "income";
                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between rounded-lg border p-3 text-sm"
                      >
                        <div>
                          <p
                            className={cn(
                              "font-medium",
                              isIncome
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400",
                            )}
                          >
                            {isIncome ? "+" : "−"}
                            {formatCurrency(transaction.amount, currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isIncome ? "Income" : "Loss"} ·{" "}
                            {formatDate(transaction.date)}
                            {isIncome && transaction.accountId
                              ? ` · to ${accountName(transaction.accountId)}`
                              : ""}
                            {transaction.notes
                              ? ` · ${transaction.notes}`
                              : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          disabled={deleteTransaction.isPending}
                          onClick={() =>
                            deleteTransaction.mutate(transaction.id)
                          }
                          aria-label="Delete entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })
                )}
                {investment.transactions.length > visibleCount ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      setVisibleCount((count) => count + HISTORY_PAGE_SIZE)
                    }
                  >
                    Show more (
                    {investment.transactions.length - visibleCount} remaining)
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {investment ? (
        <InvestmentTransactionFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          investmentId={investment.id}
          direction={direction}
          defaultAccountId={investment.accountId}
        />
      ) : null}
    </>
  );
}
