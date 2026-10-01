"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createBudgetSchema, type CreateBudgetInput } from "@/lib/schemas";
import { useCreateBudget, useUpdateBudget } from "@/hooks/use-budgets";
import { useLookups } from "@/hooks/use-lookups";
import { OVERALL_BUDGET_ID, type Budget } from "@/types/domain";
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
import { NumberField, SelectField } from "@/components/forms/fields";

interface BudgetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: Budget;
  /** Category ids that already have a budget (hidden from the picker). */
  budgetedCategoryIds: string[];
  /** Shown as a Delete button when editing. */
  onDelete?: (budget: Budget) => void;
}

export function BudgetFormDialog({
  open,
  onOpenChange,
  budget,
  budgetedCategoryIds,
  onDelete,
}: BudgetFormDialogProps) {
  const isEdit = Boolean(budget);
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const { categories, categoryOptions } = useLookups();

  const options = React.useMemo(() => {
    const taken = new Set(
      budgetedCategoryIds.filter((id) => id !== budget?.categoryId),
    );
    const list = [
      { label: "Overall (all spending)", value: OVERALL_BUDGET_ID },
      ...categoryOptions("expense"),
    ];
    // Keep the edited budget's category visible even if it was archived.
    const current = budget?.categoryId;
    if (current && !list.some((option) => option.value === current)) {
      const category = categories.find((c) => c.id === current);
      if (category) list.push({ label: category.name, value: category.id });
    }
    return list.filter((option) => !taken.has(option.value));
  }, [budgetedCategoryIds, budget?.categoryId, categories, categoryOptions]);

  const form = useForm<CreateBudgetInput>({
    resolver: zodResolver(createBudgetSchema),
    defaultValues: { categoryId: "", amount: undefined },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      budget
        ? { categoryId: budget.categoryId, amount: budget.amount }
        : { categoryId: "", amount: undefined },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, budget]);

  const onSubmit = (values: CreateBudgetInput) => {
    const done = () => onOpenChange(false);
    if (isEdit && budget) {
      updateBudget.mutate({ id: budget.id, input: values }, { onSuccess: done });
    } else {
      createBudget.mutate(values, { onSuccess: done });
    }
  };

  const submitting = createBudget.isPending || updateBudget.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit budget" : "Add budget"}</DialogTitle>
          <DialogDescription>
            Set how much you want to spend each month. You&apos;ll be warned at
            80% and when you go over.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <SelectField
              control={form.control}
              name="categoryId"
              label="Category"
              placeholder="Select category"
              options={options}
            />
            <NumberField
              control={form.control}
              name="amount"
              label="Monthly limit"
              placeholder="0.00"
            />
            <DialogFooter>
              {isEdit && budget && onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive sm:mr-auto"
                  onClick={() => onDelete(budget)}
                >
                  Delete
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Add budget"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
