"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  Gem,
  HandCoins,
  LineChart,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { useDashboard } from "@/hooks/use-dashboard";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency, formatDate } from "@/lib/format";
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

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
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

      <QueryView query={dashboardQuery} loading={<DashboardSkeleton />}>
        {(data) => (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <StatCard
                title="Total balance"
                value={formatCurrency(data.totalBalance, currency)}
                icon={Wallet}
              />
              <StatCard
                title="This month expense"
                value={formatCurrency(data.monthExpense, currency)}
                icon={TrendingDown}
              />
              <StatCard
                title="This month income"
                value={formatCurrency(data.monthIncome, currency)}
                icon={TrendingUp}
              />
              <StatCard
                title="Savings this month"
                value={formatCurrency(data.savings, currency)}
                hint={data.savings >= 0 ? "You're in the green" : "Overspending"}
                icon={PiggyBank}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <StatCard
                title="Outstanding loans"
                value={formatCurrency(data.outstandingLoans, currency)}
                hint="Money you owe"
                icon={HandCoins}
              />
              <StatCard
                title="Money lent"
                value={formatCurrency(data.moneyLent, currency)}
                hint="Owed to you"
                icon={HandCoins}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-2 lg:grid-cols-1 xl:grid-cols-3">
                <StatCard
                  title="Total investments"
                  value={formatCurrency(data.investmentValue, currency)}
                  icon={LineChart}
                />
                <StatCard
                  title="Total assets"
                  value={formatCurrency(data.assetValue, currency)}
                  icon={Boxes}
                />
                <StatCard
                  title="Net worth"
                  value={formatCurrency(data.netWorth, currency)}
                  hint="Cash + investments + assets"
                  icon={Gem}
                  className="col-span-2 lg:col-span-1"
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Net worth allocation</CardTitle>
                  <CardDescription>
                    Distribution across cash, investments and assets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AllocationChart
                    currency={currency}
                    data={[
                      {
                        name: "Cash",
                        value: data.totalBalance,
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
                    ]}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Monthly summary</CardTitle>
                  <CardDescription>
                    Income versus expense over the last 6 months
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MonthlyChart data={data.monthlySummary} currency={currency} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent transactions</CardTitle>
                  <CardDescription>Your latest activity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.recentTransactions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No transactions yet.
                    </p>
                  ) : (
                    data.recentTransactions.map((tx) => (
                      <div
                        key={`${tx.kind}-${tx.id}`}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={
                              tx.kind === "income"
                                ? "flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "flex h-8 w-8 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400"
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
                              ? "text-sm font-medium text-emerald-600 dark:text-emerald-400"
                              : "text-sm font-medium"
                          }
                        >
                          {tx.kind === "income" ? "+" : "−"}
                          {formatCurrency(tx.amount, currency)}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  Upcoming due payments
                </CardTitle>
                <CardDescription>Loans with an approaching due date</CardDescription>
              </CardHeader>
              <CardContent>
                {data.upcomingDuePayments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nothing due soon.
                  </p>
                ) : (
                  <div className="divide-y">
                    {data.upcomingDuePayments.map((loan) => (
                      <Link
                        key={loan.id}
                        href="/loans"
                        className="flex items-center justify-between py-3 text-sm hover:bg-accent/50"
                      >
                        <div>
                          <p className="font-medium">{loan.person}</p>
                          <p className="text-xs text-muted-foreground">
                            Due {loan.dueDate ? formatDate(loan.dueDate) : "—"}
                          </p>
                        </div>
                        <span className="font-medium">
                          {formatCurrency(loan.remainingBalance ?? 0, currency)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </QueryView>
    </>
  );
}
