import Link from "next/link";
import { ChevronRight, FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Entry point to the CSV statement import wizard (placed on Settings). */
export function ImportLinkCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileUp className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <CardTitle>Import bank statement</CardTitle>
            <CardDescription>
              Bring in transactions from a CSV statement — bank, bKash, Nagad
              or credit card. Duplicates are detected before anything is
              saved.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button asChild className="h-11 w-full sm:h-9 sm:w-auto">
          <Link href="/import">
            Import CSV
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
