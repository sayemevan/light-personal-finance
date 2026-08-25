"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Archive, FolderSync } from "lucide-react";

import { siteConfig } from "@/config/site";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import {
  useArchiveTransactions,
  useVerifyWorkspace,
} from "@/hooks/use-workspace";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "BDT", "JPY", "AUD", "CAD"];

export default function SettingsPage() {
  const { data: session } = useSession();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const verifyWorkspace = useVerifyWorkspace();
  const archiveTransactions = useArchiveTransactions();
  const [archiveKind, setArchiveKind] = React.useState<
    "expense" | "income" | null
  >(null);

  const user = session?.user;
  const workspaceBusy =
    verifyWorkspace.isPending || archiveTransactions.isPending;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your profile, workspace and preferences."
      />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your Google account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium sm:text-right sm:break-words">
              {user?.name ?? "—"}
            </span>
          </div>
          <Separator className="my-2" />
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="text-muted-foreground">Email</span>
            <span className="min-w-0 break-words font-medium sm:text-right">
              {user?.email ?? "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            The display currency used across the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settingsQuery.isLoading ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Currency</span>
              <Select
                value={settingsQuery.data?.currency ?? "USD"}
                onValueChange={(currency) =>
                  updateSettings.mutate({ currency })
                }
                disabled={updateSettings.isPending}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Google workspace</CardTitle>
          <CardDescription>
            {siteConfig.name} stores all of your data inside your own Google
            Drive. Re-run setup if the folder structure was changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            onClick={() => verifyWorkspace.mutate()}
            disabled={workspaceBusy}
          >
            <FolderSync className="h-4 w-4" />
            {verifyWorkspace.isPending ? "Verifying…" : "Verify workspace"}
          </Button>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Archive copies expense or income details into a dedicated Drive
              spreadsheet and leaves monthly per-category totals in the live
              sheet so balances, trends and category reports stay correct.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setArchiveKind("expense")}
                disabled={workspaceBusy}
              >
                <Archive className="h-4 w-4" />
                Archive expenses
              </Button>
              <Button
                variant="outline"
                onClick={() => setArchiveKind("income")}
                disabled={workspaceBusy}
              >
                <Archive className="h-4 w-4" />
                Archive income
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(archiveKind)}
        onOpenChange={(open) => !open && setArchiveKind(null)}
        title={
          archiveKind === "income" ? "Archive income?" : "Archive expenses?"
        }
        description={
          archiveKind === "income"
            ? "Income details will move into “Finance Income Archive” in Drive. The live list will show monthly summary rows plus any new entries. Do not use the app until this finishes."
            : "Expense details will move into “Finance Expense Archive” in Drive. The live list will show monthly summary rows plus any new entries. Do not use the app until this finishes."
        }
        confirmLabel={
          archiveKind === "income" ? "Archive income" : "Archive expenses"
        }
        destructive={false}
        loading={archiveTransactions.isPending}
        onConfirm={() => {
          if (!archiveKind) return;
          archiveTransactions.mutate(
            { kind: archiveKind },
            { onSuccess: () => setArchiveKind(null) },
          );
        }}
      />
    </>
  );
}
