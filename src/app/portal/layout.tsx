import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import QueryProvider from "@/components/providers/queryProvider";
import Sidebar from "@/components/ui/sidebar";
import { unreadAlertsQuery } from "@/queries/alertQueries";
import { getQueryClient, prefetch } from "@/queries/queryClient";
import { TheftAlertService } from "@/services/theftAlertService";
import { LOGIN_PATH } from "@/utils/authRoutes";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  // Proxy redirects first; this is the authoritative check.
  const session = await auth();
  if (!session?.user) redirect(LOGIN_PATH);

  const { id, name, email, role } = session.user;

  // So the sidebar's alert badge is right on the first paint, not a moment later.
  const queryClient = getQueryClient();
  if (role === "administrator") {
    await prefetch(queryClient, { ...unreadAlertsQuery(), queryFn: () => TheftAlertService.getUnreadCount(id) });
  }

  return (
    <QueryProvider>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <div className="flex min-h-screen flex-1 flex-col bg-slate-50 md:pl-64">
          <Sidebar user={{ name: name ?? email ?? "Signed in", role }} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
        </div>
      </HydrationBoundary>
    </QueryProvider>
  );
}
