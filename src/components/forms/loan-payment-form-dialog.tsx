"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { todayISO as today } from "@/lib/recurring";

import {
  createLoanPaymentSchema,
  type CreateLoanPaymentInput,
} from "@/lib/schemas";
import { useAddLoanPayment } from "@/hooks/use-loans";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency } from "@/lib/format";
import type { LoanPaymentDirection } from "@/types/domain";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DateField,
  NumberField,
  SelectField,
  TextareaField,
} from "@/components/forms/fields";

interface LoanPaymentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  direction: LoanPaymentDirection;
  defaultAccountId?: string;
  /** Still owed on the loan; payments can't exceed it. */
  remaining: number;
}

export function LoanPaymentFormDialog({
  open,
  onOpenChange,
  loanId,
  direction,
  defaultAccountId,
  remaining,
}: LoanPaymentFormDialogProps) {
  const currency = useCurrency();
  const addPayment = useAddLoanPayment();
  const { accountOptions } = useLookups();

  const isPaying = direction === "payment";
  const accountLabel = isPaying ? "Pay from account" : "Receive in account";
  const accountDescription = isPaying
    ? "This amount is deducted from the account you choose, and the remaining loan goes down by the same amount."
    : "This amount is added to the account you choose, and the remaining loan goes down by the same amount.";

  const form = useForm<CreateLoanPaymentInput>({
    resolver: zodResolver(createLoanPaymentSchema),
    defaultValues: {
      loanId,
      date: today(),
      amount: undefined,
      direction,
      accountId: defaultAccountId ?? "",
      notes: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      loanId,
      date: today(),
      amount: undefined,
      direction,
      accountId: defaultAccountId ?? "",
      notes: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loanId, direction, defaultAccountId]);

  const onSubmit = (values: CreateLoanPaymentInput) => {
    if (values.amount > remaining + 0.005) {
      form.setError("amount", {
        message: `Only ${formatCurrency(remaining, currency)} is still owed.`,
      });
      return;
    }
    addPayment.mutate(values, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isPaying ? "Pay back loan" : "Record receipt"}
          </DialogTitle>
          <DialogDescription>
            {isPaying
              ? "Choose which account you are paying from. The loan remaining and that account both go down."
              : "Choose which account receives this repayment. The loan remaining goes down and that account goes up."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <NumberField
                control={form.control}
                name="amount"
                label="Amount"
                placeholder="0.00"
                autoFocus
              />
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Still owed {formatCurrency(remaining, currency)}</span>
                <button
                  type="button"
                  className="font-medium text-primary"
                  onClick={() =>
                    form.setValue("amount", remaining, { shouldValidate: true })
                  }
                >
                  Full amount
                </button>
              </div>
            </div>
            <DateField control={form.control} name="date" label="Date" />
            <SelectField
              control={form.control}
              name="accountId"
              label={accountLabel}
              placeholder="Select account"
              description={accountDescription}
              options={accountOptions}
            />
            <TextareaField
              control={form.control}
              name="notes"
              label="Notes (optional)"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addPayment.isPending}>
                {addPayment.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
