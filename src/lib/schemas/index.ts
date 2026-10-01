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

/** Lower-case, "#"-less, de-duplicated tag list (max 10). */
export const tagsSchema = z
  .array(z.string())
  .max(10)
  .transform((tags) => [
    ...new Set(
      tags
        .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
        .filter(Boolean)
        .map((tag) => tag.slice(0, 40)),
    ),
  ])
  .optional();

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
  tags: tagsSchema,
});
export const updateExpenseSchema = createExpenseSchema.partial();

/**
 * Creating an expense paid for others: the expense records only your share,
 * and each other person's share becomes money lent to them (a "lent" loan from
 * the same account), so the account still drops by the full bill.
 */
export const createExpenseWithSplitSchema = createExpenseSchema.extend({
  splits: z
    .array(
      z.object({
        person: z.string().trim().min(1).max(120),
        amount,
      }),
    )
    .max(20)
    .optional(),
});

export const createIncomeSchema = z.object({
  date: isoDate,
  amount,
  categoryId: z.string().min(1),
  accountId: z.string().min(1),
  notes: optionalText,
  tags: tagsSchema,
});
export const updateIncomeSchema = createIncomeSchema.partial();

export const createTransferSchema = z
  .object({
    date: isoDate,
    amount,
    fromAccountId: z.string().min(1, "Select an account"),
    toAccountId: z.string().min(1, "Select an account"),
    notes: optionalText,
  })
  .refine((value) => value.fromAccountId !== value.toAccountId, {
    path: ["toAccountId"],
    message: "Choose a different account",
  });
export const updateTransferSchema = z
  .object({
    date: isoDate,
    amount,
    fromAccountId: z.string().min(1),
    toAccountId: z.string().min(1),
    notes: optionalText,
  })
  .partial();

export const createBudgetSchema = z.object({
  /** Expense category id, or "__overall__" for a total monthly cap. */
  categoryId: z.string().min(1, "Select a category"),
  amount,
});
export const updateBudgetSchema = createBudgetSchema.partial();

export const createGoalSchema = z.object({
  name: z.string().trim().min(1).max(120),
  targetAmount: amount,
  targetDate: isoDate.optional(),
  accountId: z.string().optional(),
});
export const updateGoalSchema = createGoalSchema
  .partial()
  .extend({ isArchived: z.boolean().optional() });

export const createGoalContributionSchema = z.object({
  goalId: z.string().min(1),
  date: isoDate,
  amount: z.coerce
    .number()
    .finite()
    .refine((value) => value !== 0, "Amount cannot be zero"),
  notes: optionalText,
});

export const recurringKindSchema = z.enum(["expense", "income", "transfer"]);
export const recurringFrequencySchema = z.enum([
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);

const recurringBase = z.object({
  kind: recurringKindSchema,
  name: z.string().trim().min(1).max(120),
  amount,
  categoryId: z.string().optional(),
  accountId: z.string().min(1, "Select an account"),
  toAccountId: z.string().optional(),
  paymentMethod: paymentMethodSchema.optional(),
  frequency: recurringFrequencySchema,
  interval: z.coerce.number().int().min(1).max(365).default(1),
  startDate: isoDate,
  endDate: isoDate.optional(),
  autoPost: z.boolean().default(false),
  isActive: z.boolean().default(true),
  notes: optionalText,
});

export const createRecurringSchema = recurringBase.superRefine((value, ctx) => {
  if (value.kind !== "transfer" && !value.categoryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["categoryId"],
      message: "Select a category",
    });
  }
  if (value.kind === "transfer") {
    if (!value.toAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toAccountId"],
        message: "Select an account",
      });
    } else if (value.toAccountId === value.accountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toAccountId"],
        message: "Choose a different account",
      });
    }
  }
  if (value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "End date must be after the start date",
    });
  }
});
export const updateRecurringSchema = recurringBase.partial();

export const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: accountTypeSchema,
  openingBalance: z.coerce.number().finite().default(0),
  /** Omitted by the UI; the server falls back to the Settings currency. */
  currency: z.string().length(3).optional(),
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
  /** "" clears the due date on edit. */
  dueDate: z.union([isoDate, z.literal("")]).optional(),
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
  /** Client's local date, used when currentValue is (re)set. */
  valuedAt: isoDate.optional(),
  accountId: z.string().optional(),
  notes: optionalText,
});
export const updateAssetSchema = createAssetSchema.partial();

export const sellAssetSchema = z.object({
  saleDate: isoDate,
  saleValue: nonNegativeAmount,
  saleAccountId: z.string().optional(),
});

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
  // A function, so it is evaluated per request, not once at server start.
  .default(() => String(new Date().getFullYear()));

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
  tag: z.string().trim().max(40).optional(),
});

export const incomeListQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  tag: z.string().trim().max(40).optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateExpenseWithSplitInput = z.input<
  typeof createExpenseWithSplitSchema
>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type CreateGoalContributionInput = z.infer<
  typeof createGoalContributionSchema
>;
export type CreateRecurringInput = z.input<typeof createRecurringSchema>;
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
export type SellAssetInput = z.infer<typeof sellAssetSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;
export type IncomeListQuery = z.infer<typeof incomeListQuerySchema>;
export type ArchiveKindInput = z.infer<typeof archiveKindSchema>;
