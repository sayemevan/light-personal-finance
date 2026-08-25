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
  "https://www.googleapis.com/auth/drive.file",
  // Read/write the finance spreadsheet.
  "https://www.googleapis.com/auth/spreadsheets",
] as const;

/** Google Drive folder / file names created on first login. */
export const DRIVE_STRUCTURE = {
  rootFolder: "My Finance",
  spreadsheet: "Finance",
  receiptsFolder: "Receipts",
  reportsFolder: "Reports",
} as const;

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
  ],
} as const;

/** Bumped whenever the sheet schema changes; drives non-destructive migrations. */
export const SCHEMA_VERSION = 4;
