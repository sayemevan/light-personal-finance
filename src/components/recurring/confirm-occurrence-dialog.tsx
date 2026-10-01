"use client";

import * as React from "react";

import { useConfirmOccurrence } from "@/hooks/use-recurring";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency, formatDate } from "@/lib/format";
import { RECURRING_KIND_LABELS } from "@/lib/labels";
import { todayISO } from "@/lib/recurring";
import type { RecurringKind } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface OccurrenceToConfirm {
  ruleId: string;
  name: string;
  kind: RecurringKind;
  amount: number;
  /** The occurrence's due date (the rule's current next date). */
  date: string;
}

interface ConfirmOccurrenceDialogProps {
  occurrence?: OccurrenceToConfirm;
  onOpenChange: (open: boolean) => void;
}

/**
 * Post one occurrence of a recurring rule, letting the user adjust the amount
 * first (e.g. a utility bill that varies month to month).
 */
export function ConfirmOccurrenceDialog({
  occurrence,
  onOpenChange,
}: ConfirmOccurrenceDialogProps) {
  const currency = useCurrency();
  const confirm = useConfirmOccurrence();
  const [amount, setAmount] = React.useState("");

  React.useEffect(() => {
    if (occurrence) setAmount(String(occurrence.amount));
  }, [occurrence]);

  const parsed = Number(amount);
  const valid = amount.trim() !== "" && Number.isFinite(parsed) && parsed > 0;
  const early = occurrence ? occurrence.date > todayISO() : false;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!occurrence || !valid) return;
    confirm.mutate(
      { id: occurrence.ruleId, date: occurrence.date, amount: parsed },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={Boolean(occurrence)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {occurrence?.name}</DialogTitle>
          <DialogDescription>
            {occurrence
              ? `${RECURRING_KIND_LABELS[occurrence.kind]} due ${formatDate(
                  occurrence.date,
                )}${early ? " — it will be recorded today" : ""}. Usually ${formatCurrency(
                  occurrence.amount,
                  currency,
                )}.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="occurrence-amount">Amount</Label>
            <Input
              id="occurrence-amount"
              type="number"
              inputMode="decimal"
              enterKeyHint="done"
              step="0.01"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={!valid}
            />
            {!valid && amount !== "" ? (
              <p className="text-sm font-medium text-destructive">
                Amount must be positive
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || confirm.isPending}>
              {confirm.isPending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
