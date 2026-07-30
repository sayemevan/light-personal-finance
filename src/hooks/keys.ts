/** Centralised React Query cache keys. */
export const queryKeys = {
  expenses: ["expenses"] as const,
  income: ["income"] as const,
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  loans: ["loans"] as const,
  loan: (id: string) => ["loans", id] as const,
  investments: ["investments"] as const,
  assets: ["assets"] as const,
  dashboard: ["dashboard"] as const,
  reports: (name: string) => ["reports", name] as const,
  settings: ["settings"] as const,
};

/** Keys that reflect derived/aggregated data affected by most mutations. */
export const derivedKeys = [
  queryKeys.dashboard,
  queryKeys.accounts,
  ["reports"],
];
