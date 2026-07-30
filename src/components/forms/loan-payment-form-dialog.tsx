"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createLoanPaymentSchema,
  type CreateLoanPaymentInput,
} from "@/lib/schemas";
import { useAddLoanPayment } from "@/hooks/use-loans";
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
  TextareaField,
} from "@/components/forms/fields";

interface LoanPaymentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  direction: LoanPaymentDirection;
}

const today = () => new Date().toISOString().slice(0, 10);

export function LoanPaymentFormDialog({
  open,
  onOpenChange,
  loanId,
  direction,
}: LoanPaymentFormDialogProps) {
  const addPayment = useAddLoanPayment();

  const form = useForm<CreateLoanPaymentInput>({
    resolver: zodResolver(createLoanPaymentSchema),
    defaultValues: {
      loanId,
      date: today(),
      amount: undefined,
      direction,
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
      notes: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loanId, direction]);

  const onSubmit = (values: CreateLoanPaymentInput) => {
    addPayment.mutate(values, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {direction === "payment" ? "Record payment" : "Record receipt"}
          </DialogTitle>
          <DialogDescription>
            Add a repayment against this loan. The remaining balance updates
            automatically.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <DateField control={form.control} name="date" label="Date" />
              <NumberField
                control={form.control}
                name="amount"
                label="Amount"
                placeholder="0.00"
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
