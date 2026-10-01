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
import { useArchiveYears } from "@/hooks/use-history";
import { useCurrency } from "@/hooks/use-settings";
import { usePagination } from "@/hooks/use-pagination";
import { formatCurrency } from "@/lib/format";
import { CATEGORY_KIND_LABELS } from "@/lib/labels";
import type { CategoryKind } from "@/types/domain";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Pagination } from "@/components/shared/pagination";
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
import {
  ALL_VALUE,
  FilterSelect,
} from "@/components/shared/filter-select";
import { OverviewTab } from "@/components/reports/overview-tab";
import { CashFlowTab } from "@/components/reports/cash-flow-tab";
import { TagsTab } from "@/components/reports/tags-tab";
import { ExportMenu } from "@/components/reports/export-menu";
import "@/app/print.css";

const CURRENT_YEAR = String(new Date().getFullYear());

export default function ReportsPage() {
  const [yearFilter, setYearFilter] = React.useState(ALL_VALUE);
  const selectedYear =
    yearFilter === ALL_VALUE ? CURRENT_YEAR : yearFilter;
  const archiveYears = useArchiveYears();
  const yearOptions = (archiveYears.data?.all ?? [])
    .filter((year) => year !== CURRENT_YEAR)
    .map((year) => ({ label: year, value: year }));
  const monthly = useMonthlyReport(selectedYear);
  const category = useCategorySummary(selectedYear);
  const account = useAccountSummary();
  const loan = useLoanSummary();
  const investment = useInvestmentSummary();
  const asset = useAssetSummary();
  const currency = useCurrency();

  const yearFilterRow = (
    <div className="flex justify-end" data-print-hide>
      <FilterSelect
        value={yearFilter}
        onChange={setYearFilter}
        options={yearOptions}
        allLabel={`${CURRENT_YEAR} (Live)`}
        placeholder="Year"
      />
    </div>
  );

  return (
    <>
      <PageHeader
        title="Reports"
        description="Summaries and insights across your finances."
        actions={<ExportMenu year={selectedYear} />}
      />

      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">Reports · {selectedYear}</h1>
        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
          Printed {new Date().toLocaleDateString("en-US", { dateStyle: "medium" })}
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList
          data-print-hide
          className="no-scrollbar h-auto w-full justify-start gap-1 overflow-x-auto sm:w-auto sm:flex-wrap [&>*]:shrink-0"
        >
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cash-flow">Cash flow</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="monthly">Monthly & Yearly</TabsTrigger>
          <TabsTrigger value="category">Category</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="loan">Loans</TabsTrigger>
          <TabsTrigger value="investment">Investments</TabsTrigger>
          <TabsTrigger value="asset">Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 md:space-y-6">
          {yearFilterRow}
          <OverviewTab year={selectedYear} currency={currency} />
        </TabsContent>

        <TabsContent value="cash-flow" className="space-y-4 md:space-y-6">
          {yearFilterRow}
          <CashFlowTab year={selectedYear} currency={currency} />
        </TabsContent>

        <TabsContent value="tags" className="space-y-4 md:space-y-6">
          {yearFilterRow}
          <TagsTab year={selectedYear} currency={currency} />
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          {yearFilterRow}
          <QueryView query={monthly}>
            {(points) => {
              const yearIncome = points.reduce((s, p) => s + p.income, 0);
              const yearExpense = points.reduce((s, p) => s + p.expense, 0);
              return (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                        {yearFilter === ALL_VALUE
                          ? "Income vs expense over the last 12 months"
                          : `Income vs expense during ${yearFilter}`}
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
          {yearFilterRow}
          <QueryView query={category}>
            {(rows) =>
              rows.length === 0 ? (
                <EmptyReport />
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                      <CategoryTotalsTable rows={rows} currency={currency} />
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
                    <AccountSummaryTable rows={rows} currency={currency} />
                  </CardContent>
                </Card>
              )
            }
          </QueryView>
        </TabsContent>

        <TabsContent value="loan" className="space-y-6">
          <QueryView query={loan}>
            {(summary) => (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                        <InvestmentBreakdownTable
                          rows={summary.byType}
                          currency={currency}
                        />
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                        <AssetBreakdownTable
                          rows={summary.byCategory}
                          currency={currency}
                        />
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

const REPORT_PAGE_SIZE = 10;

interface CategoryRow {
  categoryId: string;
  name: string;
  kind: CategoryKind;
  total: number;
}

function CategoryTotalsTable({
  rows,
  currency,
}: {
  rows: CategoryRow[];
  currency: string;
}) {
  const { pageItems, page, pageSize, total, setPage } = usePagination(
    rows,
    REPORT_PAGE_SIZE,
  );
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((row) => (
            <TableRow key={row.categoryId}>
              <TableCell>{row.name}</TableCell>
              <TableCell>
                <Badge
                  variant={row.kind === "income" ? "success" : "secondary"}
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
      {total > pageSize ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}

interface AccountRow {
  accountId: string;
  name: string;
  inflow: number;
  outflow: number;
  balance: number;
}

function AccountSummaryTable({
  rows,
  currency,
}: {
  rows: AccountRow[];
  currency: string;
}) {
  const { pageItems, page, pageSize, total, setPage } = usePagination(
    rows,
    REPORT_PAGE_SIZE,
  );
  return (
    <div className="space-y-4">
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
          {pageItems.map((row) => (
            <TableRow key={row.accountId}>
              <TableCell className="font-medium">{row.name}</TableCell>
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
      {total > pageSize ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}

interface BreakdownRow {
  key: string;
  label: string;
  currentValue: number;
  gain: number;
}

interface InvestmentRow extends BreakdownRow {
  invested: number;
}

function InvestmentBreakdownTable({
  rows,
  currency,
}: {
  rows: InvestmentRow[];
  currency: string;
}) {
  const { pageItems, page, pageSize, total, setPage } = usePagination(
    rows,
    REPORT_PAGE_SIZE,
  );
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Invested</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="text-right">Gain / loss</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className="text-right">
                {formatCurrency(row.invested, currency)}
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
      {total > pageSize ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}

interface AssetRow extends BreakdownRow {
  purchaseValue: number;
}

function AssetBreakdownTable({
  rows,
  currency,
}: {
  rows: AssetRow[];
  currency: string;
}) {
  const { pageItems, page, pageSize, total, setPage } = usePagination(
    rows,
    REPORT_PAGE_SIZE,
  );
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Purchase</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="text-right">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium">{row.label}</TableCell>
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
      {total > pageSize ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
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
