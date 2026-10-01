"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Paperclip, X } from "lucide-react";

import { createExpenseSchema, type CreateExpenseInput } from "@/lib/schemas";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/labels";
import { useLookups } from "@/hooks/use-lookups";
import { useCreateExpense, useUpdateExpense } from "@/hooks/use-expenses";
import { uploadReceiptFile } from "@/lib/api-client";
import type { Expense } from "@/types/domain";
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

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense;
}

const today = () => new Date().toISOString().slice(0, 10);

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
}: ExpenseFormDialogProps) {
  const isEdit = Boolean(expense);
  const { accountOptions, categoryOptions } = useLookups();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const [uploading, setUploading] = React.useState(false);

  const form = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      date: today(),
      amount: undefined,
      categoryId: "",
      accountId: "",
      paymentMethod: "cash",
      merchant: "",
      notes: "",
      receiptFileId: undefined,
    },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      expense
        ? {
            date: expense.date,
            amount: expense.amount,
            categoryId: expense.categoryId,
            accountId: expense.accountId,
            paymentMethod: expense.paymentMethod,
            merchant: expense.merchant ?? "",
            notes: expense.notes ?? "",
            receiptFileId: expense.receiptFileId,
          }
        : {
            date: today(),
            amount: undefined,
            categoryId: "",
            accountId: "",
            paymentMethod: "cash",
            merchant: "",
            notes: "",
            receiptFileId: undefined,
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense]);

  const receiptFileId = form.watch("receiptFileId");

  const handleReceipt = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { fileId } = await uploadReceiptFile(file);
      form.setValue("receiptFileId", fileId, { shouldDirty: true });
    } catch {
      // Errors surface via the upload helper's thrown message; keep the form
      // usable so the expense can still be saved without a receipt.
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (values: CreateExpenseInput) => {
    const done = () => onOpenChange(false);
    if (isEdit && expense) {
      updateExpense.mutate({ id: expense.id, input: values }, { onSuccess: done });
    } else {
      createExpense.mutate(values, { onSuccess: done });
    }
  };

  const submitting = createExpense.isPending || updateExpense.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>
            Record a purchase. A receipt is optional.
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
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="categoryId"
                label="Category"
                placeholder="Select category"
                options={categoryOptions("expense")}
              />
              <SelectField
                control={form.control}
                name="accountId"
                label="Account"
                placeholder="Select account"
                options={accountOptions}
              />
            </div>
            <SelectField
              control={form.control}
              name="paymentMethod"
              label="Payment method"
              options={PAYMENT_METHOD_OPTIONS}
            />
            <TextField
              control={form.control}
              name="merchant"
              label="Merchant (optional)"
              placeholder="e.g. Grocery store"
            />
            <TextareaField
              control={form.control}
              name="notes"
              label="Notes (optional)"
              placeholder="Anything worth remembering"
            />

            <div className="space-y-2">
              <span className="text-sm font-medium">Receipt (optional)</span>
              {receiptFileId ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" aria-hidden="true" /> Receipt
                    attached
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Remove receipt"
                    onClick={() => form.setValue("receiptFileId", undefined)}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                  {uploading ? "Uploading…" : "Attach a receipt"}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    disabled={uploading}
                    onChange={(event) =>
                      void handleReceipt(event.target.files?.[0])
                    }
                  />
                </label>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || uploading}>
                {submitting ? "Saving…" : isEdit ? "Save changes" : "Add expense"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
