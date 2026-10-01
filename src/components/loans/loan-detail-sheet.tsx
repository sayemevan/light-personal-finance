"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { useLoan, useDeleteLoanPayment } from "@/hooks/use-loans";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency, formatDate } from "@/lib/format";
import { LOAN_STATUS_LABELS, LOAN_TYPE_LABELS } from "@/lib/labels";
import type { LoanPaymentDirection } from "@/types/domain";
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
import { LoanPaymentFormDialog } from "@/components/forms/loan-payment-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { LoanPayment } from "@/types/domain";

interface LoanDetailSheetProps {
  loanId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HISTORY_PAGE_SIZE = 8;

export function LoanDetailSheet({
  loanId,
  open,
  onOpenChange,
}: LoanDetailSheetProps) {
  const loanQuery = useLoan(open ? loanId : undefined);
  const deletePayment = useDeleteLoanPayment();
  const { accountName } = useLookups();
  const currency = useCurrency();
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [visibleCount, setVisibleCount] = React.useState(HISTORY_PAGE_SIZE);
  const [deleting, setDeleting] = React.useState<LoanPayment | undefined>();

  React.useEffect(() => {
    setVisibleCount(HISTORY_PAGE_SIZE);
  }, [loanId, open]);

  const loan = loanQuery.data;
  const direction: LoanPaymentDirection =
    loan?.type === "lent" ? "receipt" : "payment";
  const visiblePayments = loan?.payments.slice(0, visibleCount) ?? [];
  const remaining = loan?.remainingBalance ?? 0;
  const interest =
    loan?.interestRate ? (loan.principal * loan.interestRate) / 100 : 0;
  const totalDue = (loan?.principal ?? 0) + interest;
  const paid = Math.max(0, totalDue - remaining);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto border-l-0 sm:max-w-md sm:border-l">
          {loanQuery.isLoading || !loan ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {loan.person}
                  <Badge variant="secondary">
                    {LOAN_TYPE_LABELS[loan.type]}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  {LOAN_STATUS_LABELS[loan.status]} ·{" "}
                  {loan.dueDate ? `Due ${formatDate(loan.dueDate)}` : "No due date"}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Principal</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(loan.principal, currency)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(remaining, currency)}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${totalDue > 0 ? Math.min(100, (paid / totalDue) * 100) : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(paid, currency)}{" "}
                  {loan.type === "lent" ? "received" : "repaid"} of{" "}
                  {formatCurrency(totalDue, currency)}
                  {interest > 0
                    ? ` (incl. ${formatCurrency(interest, currency)} interest)`
                    : ""}
                </p>
              </div>

              {loan.accountId ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {loan.type === "lent" ? "Taken from" : "Added to"}:{" "}
                  {accountName(loan.accountId)}
                </p>
              ) : null}
              {loan.interestRate ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Interest rate: {loan.interestRate}%
                </p>
              ) : null}
              {loan.notes ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {loan.notes}
                </p>
              ) : null}

              <Separator className="my-4" />

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Payment history</h3>
                <Button
                  size="sm"
                  onClick={() => setPaymentOpen(true)}
                  disabled={remaining <= 0}
                >
                  <Plus className="h-4 w-4" />
                  {remaining <= 0
                    ? "Fully repaid"
                    : direction === "receipt"
                      ? "Add receipt"
                      : "Add payment"}
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {loan.payments.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No payments recorded yet.
                  </p>
                ) : (
                  visiblePayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {formatCurrency(payment.amount, currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(payment.date)}
                          {payment.accountId
                            ? ` · ${payment.direction === "receipt" ? "to" : "from"} ${accountName(payment.accountId)}`
                            : loan.accountId
                              ? ` · ${loan.type === "lent" ? "to" : "from"} ${accountName(loan.accountId)}`
                              : ""}
                          {payment.notes ? ` · ${payment.notes}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-destructive sm:h-8 sm:w-8"
                        disabled={deletePayment.isPending}
                        onClick={() => setDeleting(payment)}
                        aria-label="Delete payment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
                {loan.payments.length > visibleCount ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      setVisibleCount((count) => count + HISTORY_PAGE_SIZE)
                    }
                  >
                    Show more ({loan.payments.length - visibleCount} remaining)
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {loan ? (
        <LoanPaymentFormDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          loanId={loan.id}
          direction={direction}
          defaultAccountId={loan.accountId}
          remaining={remaining}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(next) => !next && setDeleting(undefined)}
        title={direction === "receipt" ? "Delete receipt?" : "Delete payment?"}
        description="The loan's remaining balance and the account balance will be restored."
        confirmLabel="Delete"
        loading={deletePayment.isPending}
        onConfirm={() =>
          deleting &&
          deletePayment.mutate(deleting.id, {
            onSuccess: () => setDeleting(undefined),
          })
        }
      />
    </>
  );
}
