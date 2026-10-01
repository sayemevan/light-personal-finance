"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { todayISO as today } from "@/lib/recurring";

import { createAssetSchema, type CreateAssetInput } from "@/lib/schemas";
import { ASSET_CATEGORY_OPTIONS } from "@/lib/labels";
import { useLookups } from "@/hooks/use-lookups";
import { useCreateAsset, useUpdateAsset } from "@/hooks/use-assets";
import type { Asset } from "@/types/domain";
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
import {
  DateField,
  NumberField,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/forms/fields";

interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset;
}

const emptyValues = (): CreateAssetInput => ({
  name: "",
  category: "house",
  purchaseDate: today(),
  purchaseValue: undefined as unknown as number,
  currentValue: undefined as unknown as number,
  accountId: "",
  notes: "",
});

export function AssetFormDialog({
  open,
  onOpenChange,
  asset,
}: AssetFormDialogProps) {
  const isEdit = Boolean(asset);
  const { accountOptions } = useLookups();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();

  const form = useForm<CreateAssetInput>({
    resolver: zodResolver(createAssetSchema),
    defaultValues: emptyValues(),
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      asset
        ? {
            name: asset.name,
            category: asset.category,
            purchaseDate: asset.purchaseDate,
            purchaseValue: asset.purchaseValue,
            currentValue: asset.currentValue,
            accountId: asset.accountId ?? "",
            notes: asset.notes ?? "",
          }
        : emptyValues(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, asset]);

  const onSubmit = (values: CreateAssetInput) => {
    const done = () => onOpenChange(false);
    if (isEdit && asset) {
      updateAsset.mutate({ id: asset.id, input: values }, { onSuccess: done });
    } else {
      createAsset.mutate(values, { onSuccess: done });
    }
  };

  const submitting = createAsset.isPending || updateAsset.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit asset" : "Add asset"}</DialogTitle>
          <DialogDescription>
            Track what you own and its latest estimated value.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <TextField
              control={form.control}
              name="name"
              label="Name"
              placeholder="e.g. Family home, Toyota Corolla"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="category"
                label="Category"
                options={ASSET_CATEGORY_OPTIONS}
              />
              <DateField
                control={form.control}
                name="purchaseDate"
                label="Purchase date"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                control={form.control}
                name="purchaseValue"
                label="Purchase value"
                placeholder="0.00"
              />
              <NumberField
                control={form.control}
                name="currentValue"
                label="Current estimated value"
                placeholder="0.00"
              />
            </div>
            <SelectField
              control={form.control}
              name="accountId"
              label="Paid from account"
              placeholder="External source (not tracked)"
              description="Leave blank if funded from an untracked source. When set, the purchase value is deducted from that account."
              options={accountOptions}
            />
            <TextareaField
              control={form.control}
              name="notes"
              label="Notes (optional)"
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
                    : "Add asset"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
