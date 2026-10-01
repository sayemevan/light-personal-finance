"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";

import {
  createRecurringSchema,
  type CreateRecurringInput,
} from "@/lib/schemas";
import {
  PAYMENT_METHOD_OPTIONS,
  RECURRING_FREQUENCY_OPTIONS,
  RECURRING_KIND_OPTIONS,
} from "@/lib/labels";
import { describeSchedule, todayISO } from "@/lib/recurring";
import { cn } from "@/lib/utils";
import { useLookups } from "@/hooks/use-lookups";
import {
  useCreateRecurring,
  useUpdateRecurring,
} from "@/hooks/use-recurring";
import type {
  RecurringFrequency,
  RecurringKind,
  RecurringRule,
} from "@/types/domain";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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

interface RecurringFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: RecurringRule;
}

const UNIT: Record<RecurringFrequency, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
};

const NAME_PLACEHOLDER: Record<RecurringKind, string> = {
  expense: "e.g. Rent, Netflix, Internet bill",
  income: "e.g. Salary, Rental income",
  transfer: "e.g. DPS savings, Credit card bill",
};

function blank(): CreateRecurringInput {
  return {
    kind: "expense",
    name: "",
    amount: undefined as unknown as number,
    categoryId: "",
    accountId: "",
    toAccountId: "",
    paymentMethod: "bank_transfer",
    frequency: "monthly",
    interval: 1,
    startDate: todayISO(),
    endDate: undefined,
    autoPost: false,
    isActive: true,
    notes: "",
  };
}

function fromRule(rule: RecurringRule): CreateRecurringInput {
  return {
    kind: rule.kind,
    name: rule.name,
    amount: rule.amount,
    categoryId: rule.categoryId ?? "",
    accountId: rule.accountId,
    toAccountId: rule.toAccountId ?? "",
    paymentMethod: rule.paymentMethod ?? "cash",
    frequency: rule.frequency,
    interval: rule.interval,
    startDate: rule.startDate,
    endDate: rule.endDate,
    autoPost: rule.autoPost,
    isActive: rule.isActive,
    notes: rule.notes ?? "",
  };
}

/** Strip fields that don't apply to the chosen kind before saving. */
function clean(values: CreateRecurringInput): CreateRecurringInput {
  const base = { ...values, notes: values.notes ?? "" };
  if (values.kind === "transfer") {
    return { ...base, categoryId: undefined, paymentMethod: undefined };
  }
  if (values.kind === "income") {
    return { ...base, toAccountId: undefined, paymentMethod: undefined };
  }
  return { ...base, toAccountId: undefined };
}

export function RecurringFormDialog({
  open,
  onOpenChange,
  rule,
}: RecurringFormDialogProps) {
  const isEdit = Boolean(rule);
  const { accountOptions, categoryOptions } = useLookups();
  const createRecurring = useCreateRecurring();
  const updateRecurring = useUpdateRecurring();

  const form = useForm<CreateRecurringInput>({
    resolver: zodResolver(createRecurringSchema),
    defaultValues: blank(),
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(rule ? fromRule(rule) : blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule]);

  const kind = form.watch("kind");
  const frequency = form.watch("frequency");
  const interval = Number(form.watch("interval")) || 1;
  const startDate = form.watch("startDate");
  const accountId = form.watch("accountId");

  const schedulePreview = /^\d{4}-\d{2}-\d{2}$/.test(startDate ?? "")
    ? describeSchedule({ frequency, interval, startDate })
    : null;

  const setKind = (next: RecurringKind) => {
    if (next === kind) return;
    form.setValue("kind", next, { shouldDirty: true });
    // Categories are kind-specific; clear so the user picks a matching one.
    form.setValue("categoryId", "");
    form.clearErrors(["categoryId", "toAccountId"]);
  };

  const onSubmit = (values: CreateRecurringInput) => {
    const done = () => onOpenChange(false);
    const input = clean(values);
    if (isEdit && rule) {
      updateRecurring.mutate(
        { id: rule.id, input: { ...input, endDate: input.endDate ?? null } },
        { onSuccess: done },
      );
    } else {
      createRecurring.mutate(input, { onSuccess: done });
    }
  };

  const submitting = createRecurring.isPending || updateRecurring.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit recurring" : "Add recurring"}
          </DialogTitle>
          <DialogDescription>
            Rent, salary, subscriptions, EMIs or a monthly savings transfer —
            set it once and it comes up on schedule.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div
              role="radiogroup"
              aria-label="Type"
              className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
            >
              {RECURRING_KIND_OPTIONS.map((option) => {
                const active = option.value === kind;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setKind(option.value)}
                    className={cn(
                      "h-10 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <TextField
              control={form.control}
              name="name"
              label="Name"
              placeholder={NAME_PLACEHOLDER[kind]}
            />
            <NumberField
              control={form.control}
              name="amount"
              label="Amount"
              placeholder="0.00"
            />

            {kind === "transfer" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField
                  control={form.control}
                  name="accountId"
                  label="From"
                  placeholder="Select account"
                  options={accountOptions}
                />
                <SelectField
                  control={form.control}
                  name="toAccountId"
                  label="To"
                  placeholder="Select account"
                  options={accountOptions.filter((o) => o.value !== accountId)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField
                  control={form.control}
                  name="categoryId"
                  label="Category"
                  placeholder="Select category"
                  options={categoryOptions(kind)}
                />
                <SelectField
                  control={form.control}
                  name="accountId"
                  label={kind === "income" ? "Paid into" : "Paid from"}
                  placeholder="Select account"
                  options={accountOptions}
                />
              </div>
            )}

            {kind === "expense" ? (
              <SelectField
                control={form.control}
                name="paymentMethod"
                label="Payment method"
                options={PAYMENT_METHOD_OPTIONS}
              />
            ) : null}

            <div className="space-y-1.5">
              <div className="grid grid-cols-[1fr_7rem] gap-4">
                <SelectField
                  control={form.control}
                  name="frequency"
                  label="Repeats"
                  options={RECURRING_FREQUENCY_OPTIONS}
                />
                <NumberField
                  control={form.control}
                  name="interval"
                  label={`Every N ${UNIT[frequency]}s`}
                  placeholder="1"
                  step="1"
                />
              </div>
              {schedulePreview ? (
                <p className="text-xs text-muted-foreground">
                  {schedulePreview}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DateField
                control={form.control}
                name="startDate"
                label={isEdit ? "Starts on" : "First due on"}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ends on (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value ?? ""}
                        min={startDate}
                        onChange={(event) =>
                          field.onChange(event.target.value || undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="autoPost"
              render={({ field }) => {
                const checked = Boolean(field.value);
                return (
                  <FormItem>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={checked}
                      onClick={() => field.onChange(!checked)}
                      className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors",
                          checked ? "bg-primary" : "bg-muted-foreground/30",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full bg-background shadow transition-transform",
                            checked ? "translate-x-4" : "translate-x-0",
                          )}
                        >
                          {checked ? (
                            <Check className="h-3 w-3 text-primary" />
                          ) : null}
                        </span>
                      </span>
                      <span className="space-y-0.5">
                        <span className="block text-sm font-medium">
                          Add automatically when due
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {checked
                            ? "It's recorded for you on each due date."
                            : "Otherwise you'll be asked to confirm (and can adjust the amount) each time."}
                        </span>
                      </span>
                    </button>
                  </FormItem>
                );
              }}
            />

            <TextareaField
              control={form.control}
              name="notes"
              label="Notes (optional)"
              placeholder="Added to each transaction's notes"
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
                {submitting
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Add recurring"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
