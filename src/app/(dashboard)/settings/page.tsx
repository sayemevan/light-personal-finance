"use client";

import { useSession } from "next-auth/react";
import { FolderSync } from "lucide-react";

import { siteConfig } from "@/config/site";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useVerifyWorkspace } from "@/hooks/use-workspace";
import { PageHeader } from "@/components/shared/page-header";
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

  const user = session?.user;

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
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{user?.name ?? "—"}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user?.email ?? "—"}</span>
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
        <CardContent>
          <Button
            variant="outline"
            onClick={() => verifyWorkspace.mutate()}
            disabled={verifyWorkspace.isPending}
          >
            <FolderSync className="h-4 w-4" />
            {verifyWorkspace.isPending ? "Verifying…" : "Verify workspace"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
