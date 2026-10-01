"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { todayISO as today } from "@/lib/recurring";

import {
  createInvestmentSchema,
  type CreateInvestmentInput,
} from "@/lib/schemas";
import { INVESTMENT_TYPE_OPTIONS } from "@/lib/labels";
import { useLookups } from "@/hooks/use-lookups";
import {
  useCreateInvestment,
  useUpdateInvestment,
} from "@/hooks/use-investments";
import type { Investment } from "@/types/domain";
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

interface InvestmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment?: Investment;
}

/**
 * Select value for "external source" (Radix Select can't hold ""). Without
 * an explicit option, a linked account could never be unlinked again.
 */
const NO_ACCOUNT = "__none__";

const emptyValues = (): CreateInvestmentInput => ({
  name: "",
  type: "stocks",
  purchaseDate: today(),
  amountInvested: undefined as unknown as number,
  currentValue: undefined as unknown as number,
  accountId: NO_ACCOUNT,
  notes: "",
});

export function InvestmentFormDialog({
  open,
  onOpenChange,
  investment,
}: InvestmentFormDialogProps) {
  const isEdit = Boolean(investment);
  const { accountOptions, accounts } = useLookups();
  const paidFromOptions = React.useMemo(() => {
    const list = [
      { label: "External source (not tracked)", value: NO_ACCOUNT },
      ...accountOptions,
    ];
    // Keep a linked account visible even if it has since been archived.
    const linked = investment?.accountId;
    if (linked && !accountOptions.some((o) => o.value === linked)) {
      const account = accounts.find((a) => a.id === linked);
      if (account) list.push({ label: account.name, value: account.id });
    }
    return list;
  }, [accountOptions, accounts, investment?.accountId]);
  const createInvestment = useCreateInvestment();
  const updateInvestment = useUpdateInvestment();

  const form = useForm<CreateInvestmentInput>({
    resolver: zodResolver(createInvestmentSchema),
    defaultValues: emptyValues(),
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      investment
        ? {
            name: investment.name,
            type: investment.type,
            purchaseDate: investment.purchaseDate,
            amountInvested: investment.amountInvested,
            currentValue: investment.currentValue,
            accountId: investment.accountId || NO_ACCOUNT,
            notes: investment.notes ?? "",
          }
        : emptyValues(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, investment]);

  const onSubmit = (formValues: CreateInvestmentInput) => {
    const done = () => onOpenChange(false);
    // "" tells the server "external source" (and unlinks on edit).
    const values = {
      ...formValues,
      accountId:
        formValues.accountId === NO_ACCOUNT ? "" : formValues.accountId,
    };
    if (isEdit && investment) {
      updateInvestment.mutate(
        { id: investment.id, input: values },
        { onSuccess: done },
      );
    } else {
      createInvestment.mutate(values, { onSuccess: done });
    }
  };

  const submitting = createInvestment.isPending || updateInvestment.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit investment" : "Add investment"}
          </DialogTitle>
          <DialogDescription>
            Track a holding, what you put in, and what it is worth now.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <TextField
              control={form.control}
              name="name"
              label="Name"
              placeholder="e.g. Apple shares, Bitcoin, City Bank FD"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="type"
                label="Type"
                options={INVESTMENT_TYPE_OPTIONS}
              />
              <DateField
                control={form.control}
                name="purchaseDate"
                label="Purchase date"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                control={form.control}
                name="amountInvested"
                label="Invested amount"
                placeholder="0.00"
              />
              <NumberField
                control={form.control}
                name="currentValue"
                label="Current value"
                placeholder="0.00"
              />
            </div>
            <SelectField
              control={form.control}
              name="accountId"
              label="Paid from account"
              placeholder="External source (not tracked)"
              description="Leave blank if funded from an untracked source. When set, the invested amount is deducted from that account."
              options={paidFromOptions}
            />
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
                {submitting
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Add investment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
