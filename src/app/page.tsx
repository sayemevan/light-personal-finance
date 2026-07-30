import { redirect } from "next/navigation";

/** The app is dashboard-first; unauthenticated users are handled by middleware. */
export default function RootPage() {
  redirect("/dashboard");
}
