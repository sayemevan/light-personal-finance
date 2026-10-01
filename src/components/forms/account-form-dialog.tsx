"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { createAccountSchema, type CreateAccountInput } from "@/lib/schemas";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/labels";
import { useCreateAccount, useUpdateAccount } from "@/hooks/use-accounts";
import type { Account } from "@/types/domain";
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
  NumberField,
  SelectField,
  TextField,
} from "@/components/forms/fields";

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account;
}

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
}: AccountFormDialogProps) {
  const isEdit = Boolean(account);
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const form = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      name: "",
      type: "bank",
      openingBalance: 0,
    },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      account
        ? {
            name: account.name,
            type: account.type,
            openingBalance: account.openingBalance,
          }
        : { name: "", type: "bank", openingBalance: 0 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account]);

  const onSubmit = (values: CreateAccountInput) => {
    const done = () => onOpenChange(false);
    if (isEdit && account) {
      updateAccount.mutate(
        { id: account.id, input: values },
        { onSuccess: done },
      );
    } else {
      createAccount.mutate(values, { onSuccess: done });
    }
  };

  const submitting = createAccount.isPending || updateAccount.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit account" : "Add account"}</DialogTitle>
          <DialogDescription>
            Accounts hold balances and are assigned to transactions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <TextField
              control={form.control}
              name="name"
              label="Name"
              placeholder="e.g. Everyday Checking"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="type"
                label="Type"
                options={ACCOUNT_TYPE_OPTIONS}
              />
              <NumberField
                control={form.control}
                name="openingBalance"
                label="Opening balance"
                placeholder="0.00"
              />
            </div>
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
                    : "Add account"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
