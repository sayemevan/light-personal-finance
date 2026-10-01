/**
 * Central definition of the Google Drive structure and the Google Sheets
 * "schema". The service layer relies on these constants so tab names and
 * column orders are declared in exactly one place.
 */

/** OAuth scopes requested during sign-in. Least-privilege by design. */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  // Access only files this app creates (avoids the restricted `drive` scope).
  // The Sheets API accepts it too, so the spreadsheets the app creates
  // (Finance, archives) need no broader scope. `spreadsheets` (every sheet in
  // the user's Drive) is a sensitive scope that triggers Google's
  // "unverified app" warning, so it is deliberately not requested.
  "https://www.googleapis.com/auth/drive.file",
] as const;

/** Google Drive folder / file names created on first login. */
export const DRIVE_STRUCTURE = {
  rootFolder: "My Finance",
  spreadsheet: "Finance",
  receiptsFolder: "Receipts",
  reportsFolder: "Reports",
  expenseArchive: "Finance Expense Archive",
  incomeArchive: "Finance Income Archive",
} as const;

/** Worksheet in each archive spreadsheet that records per-year totals. */
export const ARCHIVE_SUMMARY_TAB = "Summary";

export const ARCHIVE_SUMMARY_COLUMNS = [
  "year",
  "total",
  "archivedAt",
  "rowCount",
] as const;

/** Live detail rows whose notes start with this prefix are skipped on archive. */
export const ARCHIVE_NOTE_PREFIX = "[Archived ";

/** Worksheet (tab) names inside the Finance spreadsheet. */
export const SHEET_TABS = {
  dashboard: "Dashboard",
  expenses: "Expenses",
  income: "Income",
  categories: "Categories",
  accounts: "Accounts",
  loans: "Loans",
  loanPayments: "Loan Payments",
  investments: "Investments",
  investmentTransactions: "Investment Transactions",
  assets: "Assets",
  transfers: "Transfers",
  budgets: "Budgets",
  goals: "Goals",
  goalContributions: "Goal Contributions",
  recurring: "Recurring",
  settings: "Settings",
} as const;

export type SheetTab = (typeof SHEET_TABS)[keyof typeof SHEET_TABS];

/**
 * Column order for each tab. The service layer maps rows to/from these headers.
 * Never reorder existing columns — append new ones to the end.
 */
export const SHEET_COLUMNS = {
  [SHEET_TABS.settings]: ["key", "value"],
  [SHEET_TABS.accounts]: [
    "id",
    "name",
    "type",
    "openingBalance",
    "currency",
    "isArchived",
    "createdAt",
  ],
  [SHEET_TABS.categories]: [
    "id",
    "name",
    "kind",
    "icon",
    "isDefault",
    "isArchived",
  ],
  [SHEET_TABS.expenses]: [
    "id",
    "date",
    "amount",
    "categoryId",
    "accountId",
    "paymentMethod",
    "merchant",
    "notes",
    "receiptFileId",
    "createdAt",
    "updatedAt",
    "tags",
  ],
  [SHEET_TABS.income]: [
    "id",
    "date",
    "amount",
    "categoryId",
    "accountId",
    "notes",
    "createdAt",
    "updatedAt",
    "tags",
  ],
  [SHEET_TABS.loans]: [
    "id",
    "type",
    "person",
    "principal",
    "interestRate",
    "borrowDate",
    "dueDate",
    "status",
    "notes",
    "createdAt",
    "accountId",
  ],
  [SHEET_TABS.loanPayments]: [
    "id",
    "loanId",
    "date",
    "amount",
    "direction",
    "notes",
    "createdAt",
    "accountId",
  ],
  [SHEET_TABS.investments]: [
    "id",
    "name",
    "type",
    "purchaseDate",
    "amountInvested",
    "currentValue",
    "notes",
    "createdAt",
    "accountId",
  ],
  [SHEET_TABS.investmentTransactions]: [
    "id",
    "investmentId",
    "date",
    "amount",
    "direction",
    "accountId",
    "notes",
    "createdAt",
  ],
  [SHEET_TABS.assets]: [
    "id",
    "name",
    "category",
    "purchaseDate",
    "purchaseValue",
    "currentValue",
    "notes",
    "createdAt",
    "accountId",
    "status",
    "valuedAt",
    "saleDate",
    "saleValue",
    "saleAccountId",
  ],
  [SHEET_TABS.transfers]: [
    "id",
    "date",
    "amount",
    "fromAccountId",
    "toAccountId",
    "notes",
    "createdAt",
  ],
  [SHEET_TABS.budgets]: ["id", "categoryId", "amount", "createdAt"],
  [SHEET_TABS.goals]: [
    "id",
    "name",
    "targetAmount",
    "targetDate",
    "accountId",
    "isArchived",
    "createdAt",
  ],
  [SHEET_TABS.goalContributions]: [
    "id",
    "goalId",
    "date",
    "amount",
    "notes",
    "createdAt",
  ],
  [SHEET_TABS.recurring]: [
    "id",
    "kind",
    "name",
    "amount",
    "categoryId",
    "accountId",
    "toAccountId",
    "paymentMethod",
    "frequency",
    "interval",
    "startDate",
    "endDate",
    "nextDate",
    "autoPost",
    "isActive",
    "notes",
    "createdAt",
  ],
} as const;

/** Bumped whenever the sheet schema changes; drives non-destructive migrations. */
export const SCHEMA_VERSION = 6;
