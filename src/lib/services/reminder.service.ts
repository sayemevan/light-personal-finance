import "server-only";
import {
  computeBudgetStatuses,
  computeLoanRemaining,
  effectiveLoanStatus,
  monthKey,
} from "@/lib/finance";
import { formatCurrency } from "@/lib/format";
import { loadLedger } from "@/lib/services/ledger.service";
import { getSettings } from "@/lib/services/settings.service";
import { OVERALL_BUDGET_ID } from "@/types/domain";
import type { ReminderItem, RemindersResponse } from "@/types/reminders";

/** Loans due within this many days (or overdue) are surfaced. */
const LOAN_DUE_WINDOW_DAYS = 3;
/** Recurring bills due within this many days (or overdue) are surfaced. */
const BILL_DUE_WINDOW_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `fromISO` to `toISO` (negative when in the past). */
function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(`${fromISO.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${toISO.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.NaN;
  return Math.round((to - from) / DAY_MS);
}

/** "today", "tomorrow" or "in N days". */
function dueIn(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** "1 day" / "N days". */
function plural(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * Everything worth reminding the user about right now: loans due soon or
 * overdue, recurring bills coming up, and budgets at or above 80% this month.
 * Derived from a single ledger read; nothing is persisted.
 */
export async function getReminders(): Promise<RemindersResponse> {
  const [ledger, settings] = await Promise.all([loadLedger(), getSettings()]);
  const money = (value: number) => formatCurrency(value, settings.currency);
  const todayISO = new Date().toISOString().slice(0, 10);
  const items: ReminderItem[] = [];

  // Loans
  for (const loan of ledger.loans) {
    if (!loan.dueDate) continue;
    const remaining = computeLoanRemaining(loan, ledger.loanPayments);
    const status = effectiveLoanStatus(loan, remaining, todayISO);
    if (status === "settled") continue;

    const days = daysBetween(todayISO, loan.dueDate);
    if (Number.isNaN(days)) continue;
    const verb = loan.type === "borrowed" ? "to" : "from";
    const body = `${money(remaining)} ${verb} ${loan.person}`;

    if (status === "overdue" || days < 0) {
      items.push({
        id: `loan_overdue:${loan.id}:${loan.dueDate}`,
        kind: "loan_overdue",
        title: `Loan overdue by ${plural(Math.abs(days))}`,
        body,
        url: "/loans",
        date: loan.dueDate,
      });
    } else if (days <= LOAN_DUE_WINDOW_DAYS) {
      items.push({
        id: `loan_due:${loan.id}:${loan.dueDate}`,
        kind: "loan_due",
        title: `Loan due ${dueIn(days)}`,
        body,
        url: "/loans",
        date: loan.dueDate,
      });
    }
  }

  // Recurring bills / income / transfers
  for (const rule of ledger.recurring) {
    if (!rule.isActive || !rule.nextDate) continue;
    if (rule.endDate && rule.endDate < rule.nextDate) continue;
    const days = daysBetween(todayISO, rule.nextDate);
    if (Number.isNaN(days) || days > BILL_DUE_WINDOW_DAYS) continue;

    const label =
      rule.kind === "income"
        ? "Income"
        : rule.kind === "transfer"
          ? "Transfer"
          : "Bill";
    items.push({
      id: `bill_due:${rule.id}:${rule.nextDate}`,
      kind: "bill_due",
      title:
        days < 0
          ? `${label} overdue by ${plural(Math.abs(days))}`
          : `${label} due ${dueIn(days)}`,
      body: `${rule.name} · ${money(rule.amount)}`,
      url: "/recurring",
      date: rule.nextDate,
    });
  }

  // Budgets
  const month = monthKey(todayISO);
  const categoryName = new Map(ledger.categories.map((c) => [c.id, c.name]));
  for (const status of computeBudgetStatuses(
    ledger.budgets,
    ledger.expenses,
    month,
  )) {
    if (status.level === "ok") continue;
    const name =
      status.categoryId === OVERALL_BUDGET_ID
        ? "Overall"
        : (categoryName.get(status.categoryId) ?? "Budget");
    const pct = Math.round(status.ratio * 100);
    const exceeded = status.level === "exceeded";
    items.push({
      id: `${exceeded ? "budget_exceeded" : "budget_warning"}:${status.id}:${month}`,
      kind: exceeded ? "budget_exceeded" : "budget_warning",
      title: exceeded
        ? `${name} budget exceeded`
        : `${name} budget at ${pct}%`,
      body: `${money(status.spent)} of ${money(status.amount)} spent this month`,
      url: "/budgets",
      date: month,
    });
  }

  return { items };
}
