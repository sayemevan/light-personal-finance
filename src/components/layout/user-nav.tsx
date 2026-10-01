"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, User as UserIcon } from "lucide-react";

import { flushQueue, queueSize } from "@/lib/offline-queue";
import { clearOfflineData } from "@/lib/pwa";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Sync offline changes before signing out; signing out wipes the queue, so
 * ask before discarding anything that still couldn't be sent.
 */
async function signOutSafely() {
  if (queueSize() > 0) {
    const { remaining } = await flushQueue().catch(() => ({
      remaining: queueSize(),
    }));
    if (
      remaining > 0 &&
      !window.confirm(
        `${remaining} change${remaining === 1 ? "" : "s"} made offline ` +
          `${remaining === 1 ? "hasn't" : "haven't"} synced yet. ` +
          "Sign out anyway and discard " +
          `${remaining === 1 ? "it" : "them"}?`,
      )
    ) {
      return;
    }
  }
  await clearOfflineData().catch(() => undefined);
  await signOut({ callbackUrl: "/sign-in" });
}

interface UserNavProps {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

function initials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserNav({ name, email, image }: UserNavProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 rounded-full p-0"
          aria-label="Open user menu"
        >
          <Avatar>
            {image ? <AvatarImage src={image} alt={name ?? "User"} /> : null}
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{name ?? "User"}</span>
          {email ? (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <UserIcon className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => void signOutSafely()}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
