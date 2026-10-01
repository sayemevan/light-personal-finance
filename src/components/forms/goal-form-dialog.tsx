"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createGoalSchema } from "@/lib/schemas";
import { useCreateGoal, useUpdateGoal } from "@/hooks/use-goals";
import { useLookups } from "@/hooks/use-lookups";
import type { Goal } from "@/types/domain";
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
} from "@/components/forms/fields";

/** Select value for "no linked account" (Radix Select can't use ""). */
const NO_ACCOUNT = "__none__";

/**
 * The API schema with form-friendly optional fields: an empty date input is
 * "", and the account picker always holds a value.
 */
const goalFormSchema = z.object({
  name: createGoalSchema.shape.name,
  targetAmount: createGoalSchema.shape.targetAmount,
  targetDate: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Expected a date in YYYY-MM-DD format"),
  accountId: z.string(),
});
type GoalFormValues = z.infer<typeof goalFormSchema>;

interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: Goal;
}

const EMPTY: GoalFormValues = {
  name: "",
  targetAmount: undefined as unknown as number,
  targetDate: "",
  accountId: NO_ACCOUNT,
};

export function GoalFormDialog({ open, onOpenChange, goal }: GoalFormDialogProps) {
  const isEdit = Boolean(goal);
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const { accounts, accountOptions } = useLookups();

  const options = React.useMemo(() => {
    const list = [{ label: "None — add money manually", value: NO_ACCOUNT }];
    list.push(...accountOptions);
    // Keep a linked account visible even if it has since been archived.
    const linked = goal?.accountId;
    if (linked && !accountOptions.some((o) => o.value === linked)) {
      const account = accounts.find((a) => a.id === linked);
      if (account) list.push({ label: account.name, value: account.id });
    }
    return list;
  }, [accountOptions, accounts, goal?.accountId]);

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: EMPTY,
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      goal
        ? {
            name: goal.name,
            targetAmount: goal.targetAmount,
            targetDate: goal.targetDate ?? "",
            accountId: goal.accountId ?? NO_ACCOUNT,
          }
        : EMPTY,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal]);

  const onSubmit = (values: GoalFormValues) => {
    const done = () => onOpenChange(false);
    const accountId = values.accountId === NO_ACCOUNT ? "" : values.accountId;
    if (isEdit && goal) {
      // "" clears the date / unlinks the account on the server.
      updateGoal.mutate(
        {
          id: goal.id,
          input: {
            name: values.name,
            targetAmount: values.targetAmount,
            targetDate: values.targetDate,
            accountId,
          },
        },
        { onSuccess: done },
      );
    } else {
      createGoal.mutate(
        {
          name: values.name,
          targetAmount: values.targetAmount,
          targetDate: values.targetDate || undefined,
          accountId: accountId || undefined,
        },
        { onSuccess: done },
      );
    }
  };

  const submitting = createGoal.isPending || updateGoal.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit goal" : "Add goal"}</DialogTitle>
          <DialogDescription>
            Something you&apos;re saving up for — an emergency fund, a trip, a
            new phone.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <TextField
              control={form.control}
              name="name"
              label="Name"
              placeholder="e.g. Emergency fund"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                control={form.control}
                name="targetAmount"
                label="Target amount"
                placeholder="0.00"
              />
              <DateField
                control={form.control}
                name="targetDate"
                label="Target date (optional)"
              />
            </div>
            <SelectField
              control={form.control}
              name="accountId"
              label="Track an account balance (optional)"
              description="Pick a dedicated savings account to follow its balance automatically. Leave it as None to add money to this goal manually."
              options={options}
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
                {submitting ? "Saving…" : isEdit ? "Save changes" : "Add goal"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
