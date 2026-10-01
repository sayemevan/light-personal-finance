"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createGoalContributionSchema,
  createGoalSchema,
  type CreateGoalContributionInput,
} from "@/lib/schemas";
import { useAddGoalContribution } from "@/hooks/use-goals";
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

/** The amount is always entered as a positive number; the mode sets its sign. */
const contributionFormSchema = createGoalContributionSchema.extend({
  amount: createGoalSchema.shape.targetAmount,
});

interface GoalContributionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalId: string;
  mode: "add" | "withdraw";
}

const today = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export function GoalContributionFormDialog({
  open,
  onOpenChange,
  goalId,
  mode,
}: GoalContributionFormDialogProps) {
  const addContribution = useAddGoalContribution();
  const isWithdraw = mode === "withdraw";

  const form = useForm<CreateGoalContributionInput>({
    resolver: zodResolver(contributionFormSchema),
    defaultValues: { goalId, date: today(), amount: undefined, notes: "" },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({ goalId, date: today(), amount: undefined, notes: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goalId]);

  const onSubmit = (values: CreateGoalContributionInput) => {
    addContribution.mutate(
      {
        ...values,
        amount: isWithdraw ? -Math.abs(values.amount) : Math.abs(values.amount),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isWithdraw ? "Withdraw money" : "Add money"}</DialogTitle>
          <DialogDescription>
            {isWithdraw
              ? "Take money back out of this goal. Your accounts aren't changed."
              : "Record money you've set aside for this goal. Your accounts aren't changed."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                control={form.control}
                name="amount"
                label="Amount"
                placeholder="0.00"
              />
              <DateField control={form.control} name="date" label="Date" />
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
              <Button type="submit" disabled={addContribution.isPending}>
                {addContribution.isPending
                  ? "Saving…"
                  : isWithdraw
                    ? "Withdraw"
                    : "Add money"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
