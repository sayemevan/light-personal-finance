import type { Metadata } from "next";
import { ShieldCheck, FileSpreadsheet, HardDrive } from "lucide-react";

import { siteConfig } from "@/config/site";
import { SignInButton } from "@/components/auth/sign-in-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sign in",
};

const permissions = [
  {
    icon: ShieldCheck,
    title: "Your Google profile",
    description: "Used only to identify your account.",
  },
  {
    icon: FileSpreadsheet,
    title: "Google Sheets",
    description: "Stores your finance data as a spreadsheet you own.",
  },
  {
    icon: HardDrive,
    title: "Google Drive",
    description: "Holds receipts and reports in a folder we create.",
  },
];

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome to {siteConfig.name}</CardTitle>
        <CardDescription>
          Sign in with Google. Your data stays in your own account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="space-y-3">
          {permissions.map((permission) => {
            const Icon = permission.icon;
            return (
              <li key={permission.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-sm font-medium">{permission.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {permission.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <SignInButton callbackUrl={callbackUrl ?? "/dashboard"} />
        <p className="text-center text-xs text-muted-foreground">
          We never store your files on our servers.
        </p>
      </CardContent>
    </Card>
  );
}
