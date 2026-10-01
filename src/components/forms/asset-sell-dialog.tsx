"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { todayISO as today } from "@/lib/recurring";

import { sellAssetSchema, type SellAssetInput } from "@/lib/schemas";
import { useLookups } from "@/hooks/use-lookups";
import { useSellAsset } from "@/hooks/use-assets";
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
} from "@/components/forms/fields";

interface AssetSellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset;
}

export function AssetSellDialog({
  open,
  onOpenChange,
  asset,
}: AssetSellDialogProps) {
  const { accountOptions } = useLookups();
  const sellAsset = useSellAsset();

  const form = useForm<SellAssetInput>({
    resolver: zodResolver(sellAssetSchema),
    defaultValues: { saleDate: today(), saleAccountId: "" },
  });

  React.useEffect(() => {
    if (!open || !asset) return;
    form.reset({
      saleDate: today(),
      saleValue: asset.currentValue,
      // Proceeds usually land where the purchase was paid from.
      saleAccountId: asset.accountId ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, asset]);

  const onSubmit = (values: SellAssetInput) => {
    if (!asset) return;
    if (values.saleDate < asset.purchaseDate) {
      form.setError("saleDate", {
        message: "Must be on or after the purchase date",
      });
      return;
    }
    sellAsset.mutate(
      { id: asset.id, input: values },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as sold</DialogTitle>
          <DialogDescription>
            {asset ? `Record the sale of ${asset.name}. ` : ""}
            It stops counting toward your net worth, and the gain becomes
            realized.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DateField
                control={form.control}
                name="saleDate"
                label="Sale date"
              />
              <NumberField
                control={form.control}
                name="saleValue"
                label="Sale value"
                placeholder="0.00"
              />
            </div>
            <SelectField
              control={form.control}
              name="saleAccountId"
              label="Proceeds received in"
              noneLabel="External (not tracked)"
              description="When set, the sale value is added to that account. Use 0 for an asset that was written off."
              options={accountOptions}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={sellAsset.isPending}>
                {sellAsset.isPending ? "Saving…" : "Mark as sold"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
