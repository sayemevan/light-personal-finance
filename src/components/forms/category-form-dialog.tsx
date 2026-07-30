"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createCategorySchema, type CreateCategoryInput } from "@/lib/schemas";
import { useCreateCategory, useUpdateCategory } from "@/hooks/use-categories";
import type { Category } from "@/types/domain";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/forms/fields";

const KIND_OPTIONS = [
  { label: "Expense", value: "expense" },
  { label: "Income", value: "income" },
];

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: CategoryFormDialogProps) {
  const isEdit = Boolean(category);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const form = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: "", kind: "expense", icon: "" },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      category
        ? { name: category.name, kind: category.kind, icon: category.icon ?? "" }
        : { name: "", kind: "expense", icon: "" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category]);

  const onSubmit = (values: CreateCategoryInput) => {
    const done = () => onOpenChange(false);
    if (isEdit && category) {
      updateCategory.mutate(
        { id: category.id, input: values },
        { onSuccess: done },
      );
    } else {
      createCategory.mutate(values, { onSuccess: done });
    }
  };

  const submitting = createCategory.isPending || updateCategory.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit category" : "Add category"}
          </DialogTitle>
          <DialogDescription>
            Categories group your expenses and income.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <TextField
              control={form.control}
              name="name"
              label="Name"
              placeholder="e.g. Groceries"
            />
            <SelectField
              control={form.control}
              name="kind"
              label="Type"
              options={KIND_OPTIONS}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Add category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
