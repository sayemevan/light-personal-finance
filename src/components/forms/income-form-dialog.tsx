"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { todayISO as today } from "@/lib/recurring";

import { createIncomeSchema, type CreateIncomeInput } from "@/lib/schemas";
import { useLookups } from "@/hooks/use-lookups";
import { useCreateIncome, useUpdateIncome } from "@/hooks/use-income";
import { useEntrySuggestions } from "@/hooks/use-expenses";
import { readEntryMemory, writeEntryMemory } from "@/lib/entry-memory";
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
  TagsField,
  TextareaField,
} from "@/components/forms/fields";

interface IncomeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income?: Income;
}

function blankValues(): CreateIncomeInput {
  const memory = readEntryMemory("income");
  return {
    date: today(),
    amount: undefined as unknown as number,
    categoryId: memory.categoryId ?? "",
    accountId: memory.accountId ?? "",
    notes: "",
    tags: [],
  };
}

export function IncomeFormDialog({
  open,
  onOpenChange,
  income,
}: IncomeFormDialogProps) {
  const isEdit = Boolean(income);
  const { accountOptions, categoryOptions } = useLookups();
  const createIncome = useCreateIncome();
  const updateIncome = useUpdateIncome();
  const suggestions = useEntrySuggestions(open);

  const form = useForm<CreateIncomeInput>({
    resolver: zodResolver(createIncomeSchema),
    defaultValues: blankValues(),
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
            tags: income.tags ?? [],
          }
        : blankValues(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, income]);

  const onSubmit = (values: CreateIncomeInput) => {
    const done = () => onOpenChange(false);
    if (isEdit && income) {
      updateIncome.mutate({ id: income.id, input: values }, { onSuccess: done });
    } else {
      writeEntryMemory("income", {
        accountId: values.accountId,
        categoryId: values.categoryId,
      });
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
            <NumberField
              control={form.control}
              name="amount"
              label="Amount"
              placeholder="0.00"
              autoFocus={!isEdit}
              className="h-14 text-2xl font-semibold sm:h-11 sm:text-xl"
            />
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
                label="Received in"
                placeholder="Account"
                options={accountOptions}
              />
            </div>
            <DateField control={form.control} name="date" label="Date" />
            <TagsField
              control={form.control}
              name="tags"
              label="Tags (optional)"
              suggestions={suggestions.data?.tags}
            />
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
