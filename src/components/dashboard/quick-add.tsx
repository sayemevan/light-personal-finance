"use client";

import * as React from "react";
import { ArrowLeftRight, Receipt, TrendingUp } from "lucide-react";

import { Fab } from "@/components/shared/fab";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ExpenseFormDialog } from "@/components/forms/expense-form-dialog";
import { IncomeFormDialog } from "@/components/forms/income-form-dialog";
import { TransferFormDialog } from "@/components/forms/transfer-form-dialog";

type Kind = "expense" | "income" | "transfer";

const CHOICES: {
  kind: Kind;
  label: string;
  hint: string;
  icon: typeof Receipt;
  tone: string;
}[] = [
  {
    kind: "expense",
    label: "Expense",
    hint: "Money spent",
    icon: Receipt,
    tone: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  {
    kind: "income",
    label: "Income",
    hint: "Money received",
    icon: TrendingUp,
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    kind: "transfer",
    label: "Transfer",
    hint: "Between accounts",
    icon: ArrowLeftRight,
    tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
];

/**
 * The dashboard's "+" button. On phones it opens a small chooser sheet
 * (Expense / Income / Transfer); each choice opens its form straight away.
 */
export function QuickAdd() {
  const [chooserOpen, setChooserOpen] = React.useState(false);
  const [form, setForm] = React.useState<Kind | null>(null);

  const choose = (kind: Kind) => {
    setChooserOpen(false);
    // Let the chooser's exit (and its history entry) settle first.
    window.setTimeout(() => setForm(kind), 160);
  };

  const close = (open: boolean) => {
    if (!open) setForm(null);
  };

  return (
    <>
      <Fab label="Add" onClick={() => setChooserOpen(true)} />

      <Sheet open={chooserOpen} onOpenChange={setChooserOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader className="text-left">
            <SheetTitle>Add</SheetTitle>
            <SheetDescription className="sr-only">
              Choose what to record
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {CHOICES.map((choice) => {
              const Icon = choice.icon;
              return (
                <button
                  key={choice.kind}
                  type="button"
                  onClick={() => choose(choice.kind)}
                  className="flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center transition-colors active:bg-accent"
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl ${choice.tone}`}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="text-sm font-medium">{choice.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {choice.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <ExpenseFormDialog open={form === "expense"} onOpenChange={close} />
      <IncomeFormDialog open={form === "income"} onOpenChange={close} />
      <TransferFormDialog open={form === "transfer"} onOpenChange={close} />
    </>
  );
}
