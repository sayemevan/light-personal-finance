"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createInvestmentTransactionSchema,
  type CreateInvestmentTransactionInput,
} from "@/lib/schemas";
import { useAddInvestmentTransaction } from "@/hooks/use-investments";
import { useLookups } from "@/hooks/use-lookups";
import type { InvestmentTransactionDirection } from "@/types/domain";
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

interface InvestmentTransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investmentId: string;
  direction: InvestmentTransactionDirection;
  defaultAccountId?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function InvestmentTransactionFormDialog({
  open,
  onOpenChange,
  investmentId,
  direction,
  defaultAccountId,
}: InvestmentTransactionFormDialogProps) {
  const addTransaction = useAddInvestmentTransaction();
  const { accountOptions } = useLookups();

  const isIncome = direction === "income";

  const form = useForm<CreateInvestmentTransactionInput>({
    resolver: zodResolver(createInvestmentTransactionSchema),
    defaultValues: {
      investmentId,
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
      investmentId,
      date: today(),
      amount: undefined,
      direction,
      accountId: defaultAccountId ?? "",
      notes: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, investmentId, direction, defaultAccountId]);

  const onSubmit = (values: CreateInvestmentTransactionInput) => {
    addTransaction.mutate(values, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isIncome ? "Add investment income" : "Add investment loss"}
          </DialogTitle>
          <DialogDescription>
            {isIncome
              ? "Money earned from this investment (dividend, interest, profit). It is added to the account you choose."
              : "A drop in this investment's value. Its current value goes down by this amount; no account is affected."}
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
            {isIncome ? (
              <SelectField
                control={form.control}
                name="accountId"
                label="Add to account"
                placeholder="Select account"
                description="This amount is added to the account you choose."
                options={accountOptions}
              />
            ) : null}
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
              <Button type="submit" disabled={addTransaction.isPending}>
                {addTransaction.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
