"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronDown,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { todayISO as today } from "@/lib/recurring";

import {
  createExpenseWithSplitSchema,
  type CreateExpenseWithSplitInput,
} from "@/lib/schemas";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/labels";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import {
  useCreateExpense,
  useEntrySuggestions,
  useUpdateExpense,
} from "@/hooks/use-expenses";
import { uploadReceiptFile } from "@/lib/api-client";
import { readEntryMemory, writeEntryMemory } from "@/lib/entry-memory";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Expense, PaymentMethod } from "@/types/domain";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  TextField,
  TextareaField,
} from "@/components/forms/fields";

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense;
}

type FormValues = CreateExpenseWithSplitInput;

function blankValues(): FormValues {
  const memory = readEntryMemory("expense");
  return {
    date: today(),
    amount: undefined as unknown as number,
    categoryId: memory.categoryId ?? "",
    accountId: memory.accountId ?? "",
    paymentMethod: (memory.paymentMethod as PaymentMethod) ?? "cash",
    merchant: "",
    notes: "",
    receiptFileId: undefined,
    tags: [],
    splits: [],
  };
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
}: ExpenseFormDialogProps) {
  const isEdit = Boolean(expense);
  const { accountOptions, categoryOptions } = useLookups();
  const currency = useCurrency();
  const suggestions = useEntrySuggestions(open);
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const [uploading, setUploading] = React.useState(false);
  const [showMore, setShowMore] = React.useState(false);
  const merchantListId = React.useId();

  const form = useForm<FormValues>({
    resolver: zodResolver(createExpenseWithSplitSchema),
    defaultValues: blankValues(),
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
            tags: expense.tags ?? [],
            splits: [],
          }
        : blankValues(),
    );
    setShowMore(
      Boolean(
        expense &&
          (expense.notes || expense.tags?.length || expense.receiptFileId),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense]);

  const receiptFileId = form.watch("receiptFileId");
  const amount = Number(form.watch("amount")) || 0;
  const splits = form.watch("splits") ?? [];
  const othersTotal = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const yourShare = amount - othersTotal;

  // Picking a merchant you've used before fills in how you usually log it,
  // unless you've already chosen a category yourself this time.
  const categoryTouched = React.useRef(false);
  React.useEffect(() => {
    if (open) categoryTouched.current = isEdit;
  }, [open, isEdit]);
  const applyMerchant = (name: string) => {
    if (categoryTouched.current) return;
    const match = suggestions.data?.merchants.find(
      (m) => m.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (!match) return;
    form.setValue("categoryId", match.categoryId, { shouldValidate: true });
    form.setValue("accountId", match.accountId, { shouldValidate: true });
    form.setValue("paymentMethod", match.paymentMethod);
  };

  const handleReceipt = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { fileId } = await uploadReceiptFile(file);
      form.setValue("receiptFileId", fileId, { shouldDirty: true });
    } catch (error) {
      // Keep the form usable so the expense can still be saved without one.
      toast.error(
        error instanceof Error ? error.message : "Receipt upload failed.",
      );
    } finally {
      setUploading(false);
    }
  };

  const setSplits = (next: { person: string; amount: number }[]) =>
    form.setValue("splits", next, { shouldDirty: true });

  const splitEqually = () => {
    const people = splits.length;
    if (!amount || people === 0) return;
    const each = Math.floor((amount / (people + 1)) * 100) / 100;
    setSplits(splits.map((s) => ({ ...s, amount: each })));
  };

  const onSubmit = (values: FormValues) => {
    const done = () => onOpenChange(false);
    if (isEdit && expense) {
      const { splits: _splits, ...input } = values;
      updateExpense.mutate({ id: expense.id, input }, { onSuccess: done });
      return;
    }
    writeEntryMemory("expense", {
      accountId: values.accountId,
      categoryId: values.categoryId,
      paymentMethod: values.paymentMethod,
    });
    createExpense.mutate(
      { ...values, splits: values.splits?.length ? values.splits : undefined },
      {
        onSuccess: (created) => {
          const alert = created.budgetAlert;
          if (alert) {
            const message =
              alert.level === "exceeded"
                ? `Over budget: ${alert.categoryName}`
                : `${alert.categoryName} budget is ${Math.round((alert.spent / alert.limit) * 100)}% used`;
            toast.warning(message, {
              description: `${formatCurrency(alert.spent, currency)} of ${formatCurrency(alert.limit, currency)} this month`,
            });
          }
          done();
        },
      },
    );
  };

  const submitting = createExpense.isPending || updateExpense.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription className="sr-only sm:not-sr-only">
            Record a purchase. A receipt is optional.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <NumberField
              control={form.control}
              name="amount"
              label={splits.length ? "Total bill" : "Amount"}
              placeholder="0.00"
              autoFocus={!isEdit}
              className="h-14 text-2xl font-semibold sm:h-11 sm:text-xl"
            />
            <TextField
              control={form.control}
              name="merchant"
              label="Merchant (optional)"
              placeholder="e.g. Shwapno, Uber, Daraz"
              list={merchantListId}
            />
            <datalist id={merchantListId}>
              {(suggestions.data?.merchants ?? []).map((m) => (
                <option key={m.name} value={m.name} />
              ))}
            </datalist>
            {/* Watch merchant edits to auto-fill category from history. */}
            <MerchantWatcher form={form} onMerchant={applyMerchant} />

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div onPointerDown={() => (categoryTouched.current = true)}>
                <SelectField
                  control={form.control}
                  name="categoryId"
                  label="Category"
                  placeholder="Category"
                  options={categoryOptions("expense")}
                />
              </div>
              <SelectField
                control={form.control}
                name="accountId"
                label="Paid from"
                placeholder="Account"
                options={accountOptions}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <DateField control={form.control} name="date" label="Date" />
              <SelectField
                control={form.control}
                name="paymentMethod"
                label="Method"
                options={PAYMENT_METHOD_OPTIONS}
              />
            </div>

            {!isEdit ? (
              <div className="space-y-3 rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    Split with others
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSplits([...splits, { person: "", amount: 0 }])
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add person
                  </Button>
                </div>
                {splits.length > 0 ? (
                  <>
                    {splits.map((split, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={split.person}
                          placeholder="Name"
                          aria-label={`Person ${index + 1}`}
                          onChange={(event) =>
                            setSplits(
                              splits.map((s, i) =>
                                i === index
                                  ? { ...s, person: event.target.value }
                                  : s,
                              ),
                            )
                          }
                        />
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={split.amount || ""}
                          placeholder="Their share"
                          aria-label={`Share for person ${index + 1}`}
                          className="w-32 shrink-0"
                          onChange={(event) =>
                            setSplits(
                              splits.map((s, i) =>
                                i === index
                                  ? { ...s, amount: Number(event.target.value) }
                                  : s,
                              ),
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          aria-label="Remove person"
                          onClick={() =>
                            setSplits(splits.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={splitEqually}
                        disabled={!amount}
                      >
                        Split equally
                      </Button>
                      <span
                        className={cn(
                          "font-medium",
                          yourShare <= 0 && "text-destructive",
                        )}
                      >
                        Your share {formatCurrency(Math.max(0, yourShare), currency)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Only your share counts as spending. Everyone else&apos;s
                      share is added to Loans as money they owe you.
                    </p>
                    {form.formState.errors.splits ? (
                      <p className="text-sm font-medium text-destructive">
                        Check each person has a name and a share, and that the
                        shares are less than the total.
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg py-1 text-sm font-medium text-muted-foreground"
              onClick={() => setShowMore((value) => !value)}
              aria-expanded={showMore}
            >
              Notes, tags & receipt
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  showMore && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>

            {showMore ? (
              <div className="space-y-4">
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
                  placeholder="Anything worth remembering"
                />

                <div className="space-y-2">
                  <span className="text-sm font-medium">Receipt (optional)</span>
                  {receiptFileId ? (
                    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4" aria-hidden="true" />{" "}
                        Receipt attached
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        aria-label="Remove receipt"
                        onClick={() =>
                          // "" (not undefined) so the PATCH clears the stored id.
                          form.setValue("receiptFileId", "", {
                            shouldDirty: true,
                          })
                        }
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Paperclip className="h-4 w-4" />
                      )}
                      {uploading ? "Uploading…" : "Attach or take a photo"}
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
              </div>
            ) : null}

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

/** Calls `onMerchant` whenever the merchant field settles on a new value. */
function MerchantWatcher({
  form,
  onMerchant,
}: {
  form: ReturnType<typeof useForm<FormValues>>;
  onMerchant: (name: string) => void;
}) {
  const merchant = form.watch("merchant") ?? "";
  const callback = React.useRef(onMerchant);
  callback.current = onMerchant;
  React.useEffect(() => {
    if (merchant) callback.current(merchant);
  }, [merchant]);
  return null;
}
