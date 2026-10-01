import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Sidebar, SIDEBAR_COOKIE } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { OfflineSync } from "@/components/pwa/offline-sync";
import { DesktopModeNotice } from "@/components/pwa/desktop-mode-notice";
import { ReminderNotifier } from "@/components/pwa/reminders";
import { RecurringRunner } from "@/components/recurring/recurring-runner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Middleware already guards these routes; this is a defensive fallback.
  if (!session?.user) {
    redirect("/sign-in");
  }

  const sidebarCollapsed =
    (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <div className="flex min-h-screen">
      <Sidebar defaultCollapsed={sidebarCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={session.user} />
        <DesktopModeNotice />
        {/* Bottom padding clears the mobile bottom nav and the FAB above it. */}
        <main className="flex-1 space-y-4 px-4 md:space-y-6 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <BottomNav />
      <PullToRefresh />
      {/* Background helpers: no UI except the offline banner / toasts. */}
      <ServiceWorkerRegister />
      <OfflineSync userId={session.user.id || session.user.email || ""} />
      <ReminderNotifier />
      <RecurringRunner />
    </div>
  );
}
