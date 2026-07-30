"use client";

import * as React from "react";
import { Plus, Tags } from "lucide-react";

import { useCategories, useDeleteCategory } from "@/hooks/use-categories";
import type { Category } from "@/types/domain";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { QueryView } from "@/components/shared/query-view";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RowActions } from "@/components/shared/row-actions";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import {
  FilterSelect,
  ALL_VALUE,
} from "@/components/shared/filter-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORY_KIND_LABELS, CATEGORY_KIND_OPTIONS } from "@/lib/labels";
import { CategoryFormDialog } from "@/components/forms/category-form-dialog";

export default function CategoriesPage() {
  const categoriesQuery = useCategories();
  const deleteCategory = useDeleteCategory();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | undefined>();
  const [deleting, setDeleting] = React.useState<Category | undefined>();
  const [kindFilter, setKindFilter] = React.useState(ALL_VALUE);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (category: Category) => {
    setEditing(category);
    setFormOpen(true);
  };

  const columns: DataTableColumn<Category>[] = React.useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (row) => <span className="font-medium">{row.name}</span>,
        sortValue: (row) => row.name,
        searchValue: (row) => row.name,
      },
      {
        id: "kind",
        header: "Type",
        cell: (row) => (
          <Badge variant={row.kind === "income" ? "success" : "secondary"}>
            {CATEGORY_KIND_LABELS[row.kind]}
          </Badge>
        ),
        sortValue: (row) => row.kind,
      },
      {
        id: "default",
        header: "Origin",
        cell: (row) =>
          row.isDefault ? (
            <span className="text-xs text-muted-foreground">Default</span>
          ) : (
            <span className="text-xs text-muted-foreground">Custom</span>
          ),
      },
      {
        id: "actions",
        header: "",
        align: "right",
        cell: (row) => (
          <RowActions
            onEdit={() => openEdit(row)}
            onDelete={() => setDeleting(row)}
          />
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise transactions into expense and income categories."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add category
          </Button>
        }
      />

      <QueryView query={categoriesQuery}>
        {(categories) =>
          categories.length === 0 ? (
            <EmptyState
              icon={Tags}
              title="No categories yet"
              description="Default categories are created on first sign-in. You can add your own at any time."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add category
                </Button>
              }
            />
          ) : (
            <DataTable
              data={categories.filter(
                (category) =>
                  kindFilter === ALL_VALUE || category.kind === kindFilter,
              )}
              columns={columns}
              getRowId={(row) => row.id}
              searchPlaceholder="Search categories…"
              onRowClick={openEdit}
              toolbar={
                <FilterSelect
                  value={kindFilter}
                  onChange={setKindFilter}
                  options={CATEGORY_KIND_OPTIONS}
                  allLabel="All types"
                />
              }
            />
          )
        }
      </QueryView>

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete category?"
        description="Transactions using this category will keep their reference. This cannot be undone."
        confirmLabel="Delete"
        loading={deleteCategory.isPending}
        onConfirm={() =>
          deleting &&
          deleteCategory.mutate(deleting.id, {
            onSuccess: () => setDeleting(undefined),
          })
        }
      />
    </>
  );
}
