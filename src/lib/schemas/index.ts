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
  notes: optionalText,
});

export const listQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type CreateLoanPaymentInput = z.infer<typeof createLoanPaymentSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
