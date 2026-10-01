import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";

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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={session.user} />
        {/* Bottom padding clears the mobile bottom nav and the FAB above it. */}
        <main className="flex-1 space-y-4 px-4 md:space-y-6 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
