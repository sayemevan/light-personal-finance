"use client";

import * as React from "react";
import { BarChart3 } from "lucide-react";

import {
  useMonthlyReport,
  useCategorySummary,
  useAccountSummary,
  useLoanSummary,
  useInvestmentSummary,
  useAssetSummary,
} from "@/hooks/use-reports";
import { useCurrency } from "@/hooks/use-settings";
import { formatCurrency } from "@/lib/format";
import { CATEGORY_KIND_LABELS } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { QueryView } from "@/components/shared/query-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MonthlyChart } from "@/components/charts/monthly-chart";
import { CategoryDonut } from "@/components/charts/category-donut";

export default function ReportsPage() {
  const monthly = useMonthlyReport();
  const category = useCategorySummary();
  const account = useAccountSummary();
  const loan = useLoanSummary();
  const investment = useInvestmentSummary();
  const asset = useAssetSummary();
  const currency = useCurrency();

  return (
    <>
      <PageHeader
        title="Reports"
        description="Summaries and insights across your finances."
      />

      <Tabs defaultValue="monthly">
        <TabsList className="h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="monthly">Monthly & Yearly</TabsTrigger>
          <TabsTrigger value="category">Category</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="loan">Loans</TabsTrigger>
          <TabsTrigger value="investment">Investments</TabsTrigger>
          <TabsTrigger value="asset">Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="space-y-6">
          <QueryView query={monthly}>
            {(points) => {
              const yearIncome = points.reduce((s, p) => s + p.income, 0);
              const yearExpense = points.reduce((s, p) => s + p.expense, 0);
              return (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard
                      title="Yearly income"
                      value={formatCurrency(yearIncome, currency)}
                    />
                    <StatCard
                      title="Yearly expense"
                      value={formatCurrency(yearExpense, currency)}
                    />
                    <StatCard
                      title="Net savings"
                      value={formatCurrency(yearIncome - yearExpense, currency)}
                    />
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle>Monthly trend</CardTitle>
                      <CardDescription>
                        Income vs expense over the last 12 months
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MonthlyChart data={points} currency={currency} />
                    </CardContent>
                  </Card>
                </>
              );
            }}
          </QueryView>
        </TabsContent>

        <TabsContent value="category" className="space-y-6">
          <QueryView query={category}>
            {(rows) =>
              rows.length === 0 ? (
                <EmptyReport />
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Spending by category</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CategoryDonut
                        data={rows
                          .filter((r) => r.kind === "expense")
                          .map((r) => ({ name: r.name, total: r.total }))}
                        currency={currency}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Category totals</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.categoryId}>
                              <TableCell>{row.name}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    row.kind === "income"
                                      ? "success"
                                      : "secondary"
                                  }
                                >
                                  {CATEGORY_KIND_LABELS[row.kind]}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(row.total, currency)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )
            }
          </QueryView>
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <QueryView query={account}>
            {(rows) =>
              rows.length === 0 ? (
                <EmptyReport />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Account summary</CardTitle>
                    <CardDescription>Inflow, outflow and balance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Inflow</TableHead>
                          <TableHead className="text-right">Outflow</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.accountId}>
                            <TableCell className="font-medium">
                              {row.name}
                            </TableCell>
                            <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(row.inflow, currency)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(row.outflow, currency)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(row.balance, currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )
            }
          </QueryView>
        </TabsContent>

        <TabsContent value="loan" className="space-y-6">
          <QueryView query={loan}>
            {(summary) => (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Total borrowed"
                  value={formatCurrency(summary.totalBorrowed, currency)}
                />
                <StatCard
                  title="Outstanding borrowed"
                  value={formatCurrency(summary.outstandingBorrowed, currency)}
                />
                <StatCard
                  title="Total lent"
                  value={formatCurrency(summary.totalLent, currency)}
                />
                <StatCard
                  title="Outstanding lent"
                  value={formatCurrency(summary.outstandingLent, currency)}
                />
              </div>
            )}
          </QueryView>
        </TabsContent>

        <TabsContent value="investment" className="space-y-6">
          <QueryView query={investment}>
            {(summary) =>
              summary.byType.length === 0 ? (
                <EmptyReport />
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      title="Total invested"
                      value={formatCurrency(summary.totalInvested, currency)}
                    />
                    <StatCard
                      title="Current value"
                      value={formatCurrency(summary.currentValue, currency)}
                    />
                    <StatCard
                      title="Total gain / loss"
                      value={formatSigned(summary.totalGain, currency)}
                    />
                    <StatCard
                      title="Overall return"
                      value={formatPercent(summary.returnPct)}
                    />
                  </div>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Value by type</CardTitle>
                        <CardDescription>
                          Current value distribution across investment types
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <CategoryDonut
                          data={summary.byType.map((r) => ({
                            name: r.label,
                            total: r.currentValue,
                          }))}
                          currency={currency}
                        />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Breakdown by type</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">
                                Invested
                              </TableHead>
                              <TableHead className="text-right">Value</TableHead>
                              <TableHead className="text-right">
                                Gain / loss
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summary.byType.map((row) => (
                              <TableRow key={row.key}>
                                <TableCell className="font-medium">
                                  {row.label}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(row.invested, currency)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(row.currentValue, currency)}
                                </TableCell>
                                <TableCell
                                  className={gainClass(row.gain)}
                                >
                                  {formatSigned(row.gain, currency)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )
            }
          </QueryView>
        </TabsContent>

        <TabsContent value="asset" className="space-y-6">
          <QueryView query={asset}>
            {(summary) =>
              summary.byCategory.length === 0 ? (
                <EmptyReport />
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      title="Total purchase value"
                      value={formatCurrency(summary.totalPurchase, currency)}
                    />
                    <StatCard
                      title="Current value"
                      value={formatCurrency(summary.currentValue, currency)}
                    />
                    <StatCard
                      title="Total change"
                      value={formatSigned(summary.totalGain, currency)}
                    />
                    <StatCard
                      title="Overall change"
                      value={formatPercent(summary.returnPct)}
                    />
                  </div>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Value by category</CardTitle>
                        <CardDescription>
                          Current value distribution across asset categories
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <CategoryDonut
                          data={summary.byCategory.map((r) => ({
                            name: r.label,
                            total: r.currentValue,
                          }))}
                          currency={currency}
                        />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Breakdown by category</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-right">
                                Purchase
                              </TableHead>
                              <TableHead className="text-right">Value</TableHead>
                              <TableHead className="text-right">Change</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summary.byCategory.map((row) => (
                              <TableRow key={row.key}>
                                <TableCell className="font-medium">
                                  {row.label}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(row.purchaseValue, currency)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(row.currentValue, currency)}
                                </TableCell>
                                <TableCell className={gainClass(row.gain)}>
                                  {formatSigned(row.gain, currency)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )
            }
          </QueryView>
        </TabsContent>
      </Tabs>
    </>
  );
}

function formatSigned(value: number, currency: string): string {
  return `${value > 0 ? "+" : ""}${formatCurrency(value, currency)}`;
}

function formatPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function gainClass(value: number): string {
  if (value > 0) return "text-right text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-right text-red-600 dark:text-red-400";
  return "text-right";
}

function EmptyReport() {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
      <BarChart3 className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Not enough data yet. Add transactions to generate this report.
      </p>
    </div>
  );
}
