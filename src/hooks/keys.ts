/** Centralised React Query cache keys. */
export const queryKeys = {
  expenses: ["expenses"] as const,
  income: ["income"] as const,
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  loans: ["loans"] as const,
  loan: (id: string) => ["loans", id] as const,
  investments: ["investments"] as const,
  investment: (id: string) => ["investments", id] as const,
  assets: ["assets"] as const,
  dashboard: ["dashboard"] as const,
  reports: (name: string) => ["reports", name] as const,
  settings: ["settings"] as const,
  archiveYears: ["archive-years"] as const,
  transfers: ["transfers"] as const,
  budgets: ["budgets"] as const,
  goals: ["goals"] as const,
  goal: (id: string) => ["goals", id] as const,
  recurring: ["recurring"] as const,
  suggestions: ["suggestions"] as const,
  tags: ["tags"] as const,
  reminders: ["reminders"] as const,
};

/** Keys that reflect derived/aggregated data affected by most mutations. */
export const derivedKeys = [
  queryKeys.dashboard,
  queryKeys.accounts,
  queryKeys.budgets,
  queryKeys.goals,
  queryKeys.reminders,
  ["reports"],
];
