"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createLoanSchema, type CreateLoanInput } from "@/lib/schemas";
import { LOAN_TYPE_OPTIONS, LOAN_STATUS_OPTIONS } from "@/lib/labels";
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

const today = () => new Date().toISOString().slice(0, 10);

export function LoanFormDialog({
  open,
  onOpenChange,
  loan,
}: LoanFormDialogProps) {
  const isEdit = Boolean(loan);
  const { accountOptions } = useLookups();
  const createLoan = useCreateLoan();
  const updateLoan = useUpdateLoan();

  const form = useForm<CreateLoanInput>({
    resolver: zodResolver(createLoanSchema),
    defaultValues: {
      type: "borrowed",
      person: "",
      accountId: "",
      principal: undefined,
      interestRate: undefined,
      borrowDate: today(),
      dueDate: undefined,
      status: "active",
      notes: "",
    },
  });

  const loanType = form.watch("type");
  const accountLabel =
    loanType === "lent" ? "Paid from account" : "Received in account";

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      loan
        ? {
            type: loan.type,
            person: loan.person,
            accountId: loan.accountId ?? "",
            principal: loan.principal,
            interestRate: loan.interestRate,
            borrowDate: loan.borrowDate,
            dueDate: loan.dueDate,
            status: loan.status,
            notes: loan.notes ?? "",
          }
        : {
            type: "borrowed",
            person: "",
            accountId: "",
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

  const onSubmit = (values: CreateLoanInput) => {
    const done = () => onOpenChange(false);
    if (isEdit && loan) {
      updateLoan.mutate({ id: loan.id, input: values }, { onSuccess: done });
    } else {
      createLoan.mutate(values, { onSuccess: done });
    }
  };

  const submitting = createLoan.isPending || updateLoan.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit loan" : "Add loan"}</DialogTitle>
          <DialogDescription>
            Track money you borrowed or lent, and its repayment.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
                options={LOAN_STATUS_OPTIONS}
              />
            </div>
            <TextField
              control={form.control}
              name="person"
              label="Person / Institution"
              placeholder="Who is it with?"
            />
            <SelectField
              control={form.control}
              name="accountId"
              label={accountLabel}
              placeholder="Select account"
              options={accountOptions}
            />
            <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="grid gap-4 sm:grid-cols-2">
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
