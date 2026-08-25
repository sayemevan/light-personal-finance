import { z } from "zod";

/**
 * Zod schemas define the input contracts for every mutating API route. Route
 * handlers parse request bodies through these before touching the service
 * layer, guaranteeing validated, well-typed data everywhere downstream.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format");

const amount = z.coerce.number().finite().positive("Amount must be positive");

const optionalText = z.string().trim().max(500).optional();

export const accountTypeSchema = z.enum([
  "cash",
  "bank",
  "credit_card",
  "mobile_banking",
  "custom",
]);

export const paymentMethodSchema = z.enum([
  "cash",
  "card",
  "bank_transfer",
  "mobile_banking",
  "other",
]);

export const categoryKindSchema = z.enum(["expense", "income"]);

export const loanTypeSchema = z.enum(["borrowed", "lent"]);
export const loanStatusSchema = z.enum(["active", "settled", "overdue"]);
export const loanPaymentDirectionSchema = z.enum(["payment", "receipt"]);

export const investmentTypeSchema = z.enum([
  "stocks",
  "mutual_fund",
  "etf",
  "crypto",
  "fixed_deposit",
  "gold",
  "custom",
]);

export const assetCategorySchema = z.enum([
  "house",
  "land",
  "vehicle",
  "jewelry",
  "electronics",
  "other",
]);

export const createExpenseSchema = z.object({
  date: isoDate,
  amount,
  categoryId: z.string().min(1),
  accountId: z.string().min(1),
  paymentMethod: paymentMethodSchema,
  merchant: optionalText,
  notes: optionalText,
  receiptFileId: z.string().optional(),
});
export const updateExpenseSchema = createExpenseSchema.partial();

export const createIncomeSchema = z.object({
  date: isoDate,
  amount,
  categoryId: z.string().min(1),
  accountId: z.string().min(1),
  notes: optionalText,
});
export const updateIncomeSchema = createIncomeSchema.partial();

export const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: accountTypeSchema,
  openingBalance: z.coerce.number().finite().default(0),
  currency: z.string().length(3).default("USD"),
});
export const updateAccountSchema = createAccountSchema
  .partial()
  .extend({ isArchived: z.boolean().optional() });

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: categoryKindSchema,
  icon: z.string().optional(),
});
export const updateCategorySchema = createCategorySchema
  .partial()
  .extend({ isArchived: z.boolean().optional() });

export const createLoanSchema = z.object({
  type: loanTypeSchema,
  person: z.string().trim().min(1).max(120),
  accountId: z.string().min(1, "Select an account"),
  principal: amount,
  interestRate: z.coerce.number().min(0).max(1000).optional(),
  borrowDate: isoDate,
  dueDate: isoDate.optional(),
  status: loanStatusSchema.default("active"),
  notes: optionalText,
});
export const updateLoanSchema = createLoanSchema.partial();

export const createLoanPaymentSchema = z.object({
  loanId: z.string().min(1),
  date: isoDate,
  amount,
  direction: loanPaymentDirectionSchema,
  accountId: z.string().min(1, "Select an account"),
  notes: optionalText,
});

export const investmentTransactionDirectionSchema = z.enum(["income", "loss"]);

export const createInvestmentTransactionSchema = z
  .object({
    investmentId: z.string().min(1),
    date: isoDate,
    amount,
    direction: investmentTransactionDirectionSchema,
    accountId: z.string().optional(),
    notes: optionalText,
  })
  .superRefine((value, ctx) => {
    if (value.direction === "income" && !value.accountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accountId"],
        message: "Select an account",
      });
    }
  });

const nonNegativeAmount = z.coerce
  .number()
  .finite()
  .min(0, "Value cannot be negative");

export const createInvestmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: investmentTypeSchema,
  purchaseDate: isoDate,
  amountInvested: amount,
  currentValue: nonNegativeAmount,
  accountId: z.string().optional(),
  notes: optionalText,
});
export const updateInvestmentSchema = createInvestmentSchema.partial();

export const createAssetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: assetCategorySchema,
  purchaseDate: isoDate,
  purchaseValue: amount,
  currentValue: nonNegativeAmount,
  accountId: z.string().optional(),
  notes: optionalText,
});
export const updateAssetSchema = createAssetSchema.partial();

export const listQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const sortDirSchema = z.enum(["asc", "desc"]);
export const yearSchema = z
  .union([
    z.literal("live"),
    z.string().regex(/^\d{4}$/, "Expected a year in YYYY format"),
  ])
  .default(String(new Date().getFullYear()));

export const reportYearQuerySchema = z.object({
  year: yearSchema,
});

/** Shared pagination / search / sort parameters for list endpoints. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  search: z.string().trim().max(200).optional(),
  sortBy: z.string().max(40).optional(),
  sortDir: sortDirSchema.optional(),
  year: yearSchema,
});

export const archiveKindSchema = z.object({
  kind: categoryKindSchema,
});

export const expenseListQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
});

export const incomeListQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type CreateLoanPaymentInput = z.infer<typeof createLoanPaymentSchema>;
export type CreateInvestmentTransactionInput = z.infer<
  typeof createInvestmentTransactionSchema
>;
export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;
export type IncomeListQuery = z.infer<typeof incomeListQuerySchema>;
export type ArchiveKindInput = z.infer<typeof archiveKindSchema>;
