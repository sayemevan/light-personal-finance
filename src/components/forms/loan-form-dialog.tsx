"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { todayISO as today } from "@/lib/recurring";

import { createLoanSchema, type CreateLoanInput } from "@/lib/schemas";
import { LOAN_TYPE_OPTIONS } from "@/lib/labels";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency } from "@/lib/format";
import { useLookups } from "@/hooks/use-lookups";
import { useCreateLoan, useUpdateLoan } from "@/hooks/use-loans";
import type { Loan } from "@/types/domain";
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
  TextField,
  TextareaField,
} from "@/components/forms/fields";

interface LoanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan?: Loan;
}

export function LoanFormDialog({
  open,
  onOpenChange,
  loan,
}: LoanFormDialogProps) {
  const isEdit = Boolean(loan);
  const { accountOptionsWith } = useLookups();
  const accountOptions = accountOptionsWith(loan?.accountId);
  const createLoan = useCreateLoan();
  const updateLoan = useUpdateLoan();
  const currency = useCurrency();

  const form = useForm<CreateLoanInput>({
    resolver: zodResolver(createLoanSchema),
    defaultValues: {
      type: "borrowed",
      person: "",
      accountId: "",
      existing: false,
      principal: undefined,
      interestRate: undefined,
      borrowDate: today(),
      dueDate: undefined,
      status: "active",
      notes: "",
    },
  });

  const loanType = form.watch("type");
  const isLent = loanType === "lent";
  const existing = form.watch("existing") ?? false;
  const accountLabel = isLent ? "Take from account" : "Add to account";
  const accountDescription = isLent
    ? "The amount you lend is deducted from this account."
    : "The amount you borrow is added to this account (cash, bank, etc.).";

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      loan
        ? {
            type: loan.type,
            person: loan.person,
            accountId: loan.accountId ?? "",
            existing: !loan.accountId,
            principal: loan.principal,
            interestRate: loan.interestRate,
            borrowDate: loan.borrowDate,
            dueDate: loan.dueDate ?? "",
            // The saved choice, not the automatic overdue/settled display.
            status:
              (loan.storedStatus ?? loan.status) === "settled"
                ? "settled"
                : "active",
            notes: loan.notes ?? "",
          }
        : {
            type: "borrowed",
            person: "",
            accountId: "",
            existing: false,
            principal: undefined,
            interestRate: undefined,
            borrowDate: today(),
            dueDate: undefined,
            status: "active",
            notes: "",
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loan]);

  const principal = Number(form.watch("principal")) || 0;
  const interestRate = Number(form.watch("interestRate")) || 0;
  const totalDue = principal + (principal * interestRate) / 100;

  const onSubmit = (values: CreateLoanInput) => {
    const done = () => onOpenChange(false);
    if (isEdit && loan) {
      // Send explicit "cleared" values so removing a due date or the
      // interest rate actually saves (undefined fields are dropped in JSON).
      updateLoan.mutate(
        {
          id: loan.id,
          input: {
            ...values,
            dueDate: values.dueDate ?? "",
            interestRate: values.interestRate ?? 0,
          },
        },
        { onSuccess: done },
      );
    } else {
      createLoan.mutate(
        { ...values, dueDate: values.dueDate || undefined },
        { onSuccess: done },
      );
    }
  };

  const submitting = createLoan.isPending || updateLoan.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit loan" : "Add loan"}</DialogTitle>
          <DialogDescription>
            {isLent
              ? "Record money you lent someone. Choose which of your accounts it left."
              : "Record money you borrowed. Choose which of your accounts it was added to. When you pay it back, you will pick which account to pay from."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="type"
                label="Type"
                options={LOAN_TYPE_OPTIONS}
              />
              <SelectField
                control={form.control}
                name="status"
                label="Status"
                options={[
                  { label: "Active", value: "active" },
                  { label: "Settled (close it)", value: "settled" },
                ]}
                description="Overdue and fully repaid are detected automatically."
              />
            </div>
            <TextField
              control={form.control}
              name="person"
              label="Person / Institution"
              placeholder="Who is it with?"
            />
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                checked={existing}
                onChange={(event) => {
                  form.setValue("existing", event.target.checked);
                  if (event.target.checked) form.clearErrors("accountId");
                }}
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">Previous loan</span>
                <span className="block text-xs text-muted-foreground">
                  Taken or given before you started using the app. No account
                  balance is changed.
                </span>
              </span>
            </label>
            {existing ? null : (
              <SelectField
                control={form.control}
                name="accountId"
                label={accountLabel}
                placeholder="Select account"
                description={accountDescription}
                options={accountOptions}
              />
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                control={form.control}
                name="principal"
                label="Amount"
                placeholder="0.00"
              />
              <NumberField
                control={form.control}
                name="interestRate"
                label="Interest rate % (optional)"
                placeholder="0"
                step="0.1"
              />
            </div>
            {interestRate > 0 && principal > 0 ? (
              <p className="-mt-2 text-xs text-muted-foreground">
                Total to repay {formatCurrency(totalDue, currency)} (simple
                interest on the amount).
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DateField
                control={form.control}
                name="borrowDate"
                label="Start date"
              />
              <DateField
                control={form.control}
                name="dueDate"
                label="Due date (optional)"
              />
            </div>
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
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : isEdit ? "Save changes" : "Add loan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
