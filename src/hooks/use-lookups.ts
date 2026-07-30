"use client";

import * as React from "react";

import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import type { CategoryKind } from "@/types/domain";

/**
 * Reference data for accounts and categories: id→name lookups plus ready-made
 * option lists for select inputs. Shared by every form and data table.
 */
export function useLookups() {
  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();

  const accountsData = accountsQuery.data;
  const categoriesData = categoriesQuery.data;
  const isLoading = accountsQuery.isLoading || categoriesQuery.isLoading;

  return React.useMemo(() => {
    const accounts = accountsData ?? [];
    const categories = categoriesData ?? [];

    const accountName = (id: string) =>
      accounts.find((a) => a.id === id)?.name ?? "—";
    const categoryName = (id: string) =>
      categories.find((c) => c.id === id)?.name ?? "—";

    const accountOptions = accounts
      .filter((a) => !a.isArchived)
      .map((a) => ({ label: a.name, value: a.id }));

    const categoryOptions = (kind: CategoryKind) =>
      categories
        .filter((c) => c.kind === kind && !c.isArchived)
        .map((c) => ({ label: c.name, value: c.id }));

    return {
      accounts,
      categories,
      accountName,
      categoryName,
      accountOptions,
      categoryOptions,
      isLoading,
    };
  }, [accountsData, categoriesData, isLoading]);
}
