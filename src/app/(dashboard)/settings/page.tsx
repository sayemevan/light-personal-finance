"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Archive, Bell, FolderSync, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { siteConfig } from "@/config/site";
import {
  clearOfflineData,
  getReminderSupport,
  notifyDueReminders,
  registerReminderSync,
  requestReminderPermission,
  type ReminderSupport,
} from "@/lib/pwa";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import {
  useArchiveTransactions,
  useVerifyWorkspace,
} from "@/hooks/use-workspace";
import { PageHeader } from "@/components/shared/page-header";
import { ImportLinkCard } from "@/components/import/import-link-card";
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

const REMINDER_STATUS_LABEL: Record<ReminderSupport, string> = {
  on: "On",
  off: "Off",
  blocked: "Blocked in browser settings",
  unsupported: "Not supported on this browser",
};

function RemindersCard() {
  // Read permission after mount so server and first client render match.
  const [status, setStatus] = React.useState<ReminderSupport | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);

  React.useEffect(() => {
    setStatus(getReminderSupport());
  }, []);

  const turnOn = async () => {
    setBusy(true);
    try {
      const next = await requestReminderPermission();
      setStatus(next);
      if (next === "on") {
        await registerReminderSync();
        const shown = await notifyDueReminders();
        toast.success(
          shown > 0
            ? "Reminders are on."
            : "Reminders are on. Nothing is due right now.",
        );
      } else if (next === "blocked") {
        toast.error(
          "Notifications are blocked. Allow them in your browser's site settings.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setClearing(true);
    try {
      await clearOfflineData();
      toast.success("Offline data cleared.");
      setClearOpen(false);
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reminders & offline</CardTitle>
        <CardDescription>
          Get a notification about loans due within 3 days or overdue,
          recurring bills due within 2 days, and budgets that reach 80% of
          their monthly limit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Reminders are checked when you open the app. On Android with the app
          installed, your phone may also check in the background now and then
          — the browser decides when, so timing isn&apos;t exact.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Status</span>
          <span className="text-sm font-medium">
            {status ? REMINDER_STATUS_LABEL[status] : "—"}
          </span>
          {status === "off" ? (
            <Button
              variant="outline"
              onClick={() => void turnOn()}
              disabled={busy}
            >
              <Bell className="h-4 w-4" />
              {busy ? "Turning on…" : "Turn on reminders"}
            </Button>
          ) : null}
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Recently viewed data is kept on this device so it can be shown
            offline. Changes made offline that haven&apos;t synced yet will be
            lost if you clear it.
          </p>
          <Button
            variant="outline"
            onClick={() => setClearOpen(true)}
            disabled={clearing}
          >
            <Trash2 className="h-4 w-4" />
            Clear offline data
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear offline data?"
        description="Cached pages and data on this device will be removed, along with any offline changes that haven't synced yet. Your Google Sheet is not affected."
        confirmLabel="Clear"
        loading={clearing}
        onConfirm={() => void clear()}
      />
    </Card>
  );
}

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

      <ImportLinkCard />

      <RemindersCard />

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
