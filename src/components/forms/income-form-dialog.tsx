"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createIncomeSchema, type CreateIncomeInput } from "@/lib/schemas";
import { useLookups } from "@/hooks/use-lookups";
import { useCreateIncome, useUpdateIncome } from "@/hooks/use-income";
import type { Income } from "@/types/domain";
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

interface IncomeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income?: Income;
}

const today = () => new Date().toISOString().slice(0, 10);

export function IncomeFormDialog({
  open,
  onOpenChange,
  income,
}: IncomeFormDialogProps) {
  const isEdit = Boolean(income);
  const { accountOptions, categoryOptions } = useLookups();
  const createIncome = useCreateIncome();
  const updateIncome = useUpdateIncome();

  const form = useForm<CreateIncomeInput>({
    resolver: zodResolver(createIncomeSchema),
    defaultValues: {
      date: today(),
      amount: undefined,
      categoryId: "",
      accountId: "",
      notes: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      income
        ? {
            date: income.date,
            amount: income.amount,
            categoryId: income.categoryId,
            accountId: income.accountId,
            notes: income.notes ?? "",
          }
        : {
            date: today(),
            amount: undefined,
            categoryId: "",
            accountId: "",
            notes: "",
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, income]);

  const onSubmit = (values: CreateIncomeInput) => {
    const done = () => onOpenChange(false);
    if (isEdit && income) {
      updateIncome.mutate({ id: income.id, input: values }, { onSuccess: done });
    } else {
      createIncome.mutate(values, { onSuccess: done });
    }
  };

  const submitting = createIncome.isPending || updateIncome.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit income" : "Add income"}</DialogTitle>
          <DialogDescription>Record money you received.</DialogDescription>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="categoryId"
                label="Category"
                placeholder="Select category"
                options={categoryOptions("income")}
              />
              <SelectField
                control={form.control}
                name="accountId"
                label="Account"
                placeholder="Select account"
                options={accountOptions}
              />
            </div>
            <TextareaField
              control={form.control}
              name="notes"
              label="Notes (optional)"
              placeholder="Source or details"
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
                {submitting ? "Saving…" : isEdit ? "Save changes" : "Add income"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
