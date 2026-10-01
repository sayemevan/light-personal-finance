"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  PiggyBank,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { useDashboard } from "@/hooks/use-dashboard";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardSummary } from "@/types/domain";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { QueryView } from "@/components/shared/query-view";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MonthlyChart } from "@/components/charts/monthly-chart";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { QuickAdd } from "@/components/dashboard/quick-add";
import { BudgetOverview } from "@/components/dashboard/budget-overview";
import { GoalsOverview } from "@/components/dashboard/goals-overview";
import { UpcomingBills } from "@/components/dashboard/upcoming-bills";

function DashboardSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

/** Headline card: net worth, with what makes it up. */
function NetWorthCard({
  data,
  currency,
}: {
  data: DashboardSummary;
  currency: string;
}) {
  const parts = [
    { label: "Cash & accounts", value: data.totalBalance, href: "/accounts" },
    { label: "Investments", value: data.investmentValue, href: "/investments" },
    { label: "Assets", value: data.assetValue, href: "/assets" },
    { label: "Lent to others", value: data.moneyLent, href: "/loans" },
    { label: "You owe", value: -data.outstandingLoans, href: "/loans" },
  ].filter((part) => part.value !== 0 || part.label === "Cash & accounts");

  return (
    <Card className="overflow-hidden border-0 bg-primary text-primary-foreground shadow-lg shadow-primary/20">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div>
          <p className="text-sm font-medium opacity-80">Net worth</p>
          <p className="mt-1 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
            {formatCurrency(data.netWorth, currency)}
          </p>
          <p className="mt-1 text-xs opacity-75">
            What you own plus money lent, minus what you owe
          </p>
        </div>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
          {parts.map((part) => (
            <Link
              key={part.label}
              href={part.href}
              className="shrink-0 rounded-xl bg-primary-foreground/15 px-3 py-2 transition-colors active:bg-primary-foreground/25"
            >
              <p className="text-[11px] opacity-80">{part.label}</p>
              <p className="text-sm font-semibold">
                {formatCurrency(part.value, currency)}
              </p>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const dashboardQuery = useDashboard();
  const { categoryName, accountName } = useLookups();
  const currency = useCurrency();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="An overview of your money across all accounts."
      />
      <QuickAdd />

      <QueryView query={dashboardQuery} loading={<DashboardSkeleton />}>
        {(data) => (
          <div className="space-y-4 md:space-y-6">
            <NetWorthCard data={data} currency={currency} />

            {/* Phones: one compact "this month" strip. Larger: stat cards. */}
            <Card className="sm:hidden">
              <CardContent className="grid grid-cols-3 divide-x p-0">
                {[
                  { label: "Income", value: data.monthIncome, tone: "text-emerald-600 dark:text-emerald-400" },
                  { label: "Spent", value: data.monthExpense, tone: "" },
                  {
                    label: "Saved",
                    value: data.savings,
                    tone: data.savings < 0 ? "text-red-600 dark:text-red-400" : "",
                  },
                ].map((item) => (
                  <div key={item.label} className="px-3 py-3.5 text-center">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p
                      className={cn("mt-1 text-base font-semibold", item.tone)}
                      title={formatCurrency(item.value, currency)}
                    >
                      {formatCompactCurrency(item.value, currency)}
                    </p>
                  </div>
                ))}
              </CardContent>
              <p className="border-t py-1.5 text-center text-[11px] text-muted-foreground">
                This month
              </p>
            </Card>
            <div className="hidden grid-cols-3 gap-4 sm:grid">
              <StatCard
                title="Income this month"
                value={formatCurrency(data.monthIncome, currency)}
                icon={TrendingUp}
              />
              <StatCard
                title="Spent this month"
                value={formatCurrency(data.monthExpense, currency)}
                icon={TrendingDown}
              />
              <StatCard
                title="Saved this month"
                value={formatCurrency(data.savings, currency)}
                hint={data.savings >= 0 ? "You're in the green" : "Overspending"}
                icon={PiggyBank}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
              <UpcomingBills />
              <BudgetOverview />
            </div>

            <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="space-y-1.5">
                    <CardTitle>Recent transactions</CardTitle>
                    <CardDescription>Your latest activity</CardDescription>
                  </div>
                  <Link
                    href="/expenses"
                    className="flex items-center text-sm font-medium text-primary"
                  >
                    See all
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </CardHeader>
                <CardContent className="space-y-1 px-3 sm:px-6">
                  {data.recentTransactions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No transactions yet. Tap + to add your first one.
                    </p>
                  ) : (
                    data.recentTransactions.map((tx) => (
                      <Link
                        key={`${tx.kind}-${tx.id}`}
                        href={tx.kind === "income" ? "/income" : "/expenses"}
                        className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 transition-colors active:bg-accent sm:hover:bg-accent/50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={
                              tx.kind === "income"
                                ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400"
                            }
                          >
                            {tx.kind === "income" ? (
                              <ArrowUpRight className="h-4 w-4" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {tx.description || categoryName(tx.categoryId)}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {accountName(tx.accountId)} · {formatDate(tx.date)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={
                            tx.kind === "income"
                              ? "shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400"
                              : "shrink-0 text-sm font-semibold"
                          }
                        >
                          {tx.kind === "income" ? "+" : "−"}
                          {formatCurrency(tx.amount, currency)}
                        </span>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4 md:space-y-6">
                <GoalsOverview />
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4" />
                      Loans due
                    </CardTitle>
                    <CardDescription>Overdue and upcoming due dates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.upcomingDuePayments.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        Nothing due soon.
                      </p>
                    ) : (
                      <div className="divide-y">
                        {data.upcomingDuePayments.map((loan) => (
                          <Link
                            key={loan.id}
                            href="/loans"
                            className="flex items-center justify-between py-3 text-sm active:bg-accent sm:hover:bg-accent/50"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {loan.person}
                              </p>
                              <p
                                className={
                                  loan.status === "overdue"
                                    ? "text-xs font-medium text-red-600 dark:text-red-400"
                                    : "text-xs text-muted-foreground"
                                }
                              >
                                {loan.status === "overdue"
                                  ? "Overdue · was due "
                                  : "Due "}
                                {loan.dueDate ? formatDate(loan.dueDate) : "—"}
                              </p>
                            </div>
                            <span className="shrink-0 font-medium">
                              {formatCurrency(loan.remainingBalance ?? 0, currency)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Monthly summary</CardTitle>
                  <CardDescription>
                    Income versus expense over the last 6 months
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-6">
                  <MonthlyChart data={data.monthlySummary} currency={currency} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Where your wealth is</CardTitle>
                  <CardDescription>
                    Cash, investments, assets and money lent
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AllocationChart
                    currency={currency}
                    data={[
                      {
                        name: "Cash",
                        value: Math.max(0, data.totalBalance),
                        color: "hsl(221 83% 53%)",
                      },
                      {
                        name: "Investments",
                        value: data.investmentValue,
                        color: "hsl(142 71% 45%)",
                      },
                      {
                        name: "Assets",
                        value: data.assetValue,
                        color: "hsl(38 92% 50%)",
                      },
                      {
                        name: "Lent",
                        value: data.moneyLent,
                        color: "hsl(280 65% 60%)",
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </QueryView>
    </>
  );
}
