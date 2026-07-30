"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SignInButton({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signIn("google", { callbackUrl });
      }}
    >
      <LogIn className="h-4 w-4" />
      {pending ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}
