"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown } from "lucide-react";
import { todayISO as today } from "@/lib/recurring";

import { createTransferSchema, type CreateTransferInput } from "@/lib/schemas";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { useCreateTransfer, useUpdateTransfer } from "@/hooks/use-transfers";
import { formatCurrency } from "@/lib/format";
import type { Transfer } from "@/types/domain";
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

interface TransferFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer?: Transfer;
  /** Pre-select the source account (e.g. from an account's menu). */
  defaultFromAccountId?: string;
}

export function TransferFormDialog({
  open,
  onOpenChange,
  transfer,
  defaultFromAccountId,
}: TransferFormDialogProps) {
  const isEdit = Boolean(transfer);
  const { accounts, accountOptions } = useLookups();
  const currency = useCurrency();
  const createTransfer = useCreateTransfer();
  const updateTransfer = useUpdateTransfer();

  const form = useForm<CreateTransferInput>({
    resolver: zodResolver(createTransferSchema),
    defaultValues: {
      date: today(),
      amount: undefined,
      fromAccountId: "",
      toAccountId: "",
      notes: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      transfer
        ? {
            date: transfer.date,
            amount: transfer.amount,
            fromAccountId: transfer.fromAccountId,
            toAccountId: transfer.toAccountId,
            notes: transfer.notes ?? "",
          }
        : {
            date: today(),
            amount: undefined,
            fromAccountId: defaultFromAccountId ?? "",
            toAccountId: "",
            notes: "",
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transfer]);

  const fromAccountId = form.watch("fromAccountId");
  const fromBalance = accounts.find((a) => a.id === fromAccountId)
    ?.currentBalance;

  const onSubmit = (values: CreateTransferInput) => {
    const done = () => onOpenChange(false);
    if (isEdit && transfer) {
      updateTransfer.mutate(
        { id: transfer.id, input: values },
        { onSuccess: done },
      );
    } else {
      createTransfer.mutate(values, { onSuccess: done });
    }
  };

  const submitting = createTransfer.isPending || updateTransfer.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit transfer" : "Transfer money"}</DialogTitle>
          <DialogDescription>
            Move money between your own accounts, e.g. bank to bKash or paying a
            credit card. Transfers aren&apos;t counted as income or expense.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <NumberField
              control={form.control}
              name="amount"
              label="Amount"
              placeholder="0.00"
              autoFocus={!isEdit}
            />
            <div className="space-y-1">
              <SelectField
                control={form.control}
                name="fromAccountId"
                label="From"
                placeholder="Select account"
                options={accountOptions}
              />
              {fromBalance !== undefined ? (
                <p className="text-xs text-muted-foreground">
                  Balance {formatCurrency(fromBalance, currency)}
                </p>
              ) : null}
            </div>
            <div className="-my-1 flex justify-center text-muted-foreground">
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </div>
            <SelectField
              control={form.control}
              name="toAccountId"
              label="To"
              placeholder="Select account"
              options={accountOptions.filter((o) => o.value !== fromAccountId)}
            />
            <DateField control={form.control} name="date" label="Date" />
            <TextareaField
              control={form.control}
              name="notes"
              label="Notes (optional)"
              placeholder="e.g. Credit card bill. Record any fee as an expense."
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
                {submitting ? "Saving…" : isEdit ? "Save changes" : "Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
