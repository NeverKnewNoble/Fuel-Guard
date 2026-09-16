import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import AlertQueueCard from "@/components/alerts/alertQueueCard";
import AlertStats from "@/components/alerts/alertStats";
import PageHeader from "@/components/ui/pageHeader";
import { alertCountsQuery, alertsQuery } from "@/queries/alertQueries";
import { getQueryClient, prefetch } from "@/queries/queryClient";
import { SessionService } from "@/services/sessionService";
import { TheftAlertService } from "@/services/theftAlertService";

export default async function TheftAlertsPage() {
  const actor = await SessionService.requireUser();

  const queryClient = getQueryClient();
  await Promise.all([
    prefetch(queryClient, { ...alertsQuery(), queryFn: () => TheftAlertService.list({ userId: actor.id }) }),
    prefetch(queryClient, { ...alertCountsQuery(), queryFn: () => TheftAlertService.getCounts() }),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        eyebrow="Administration"
        title="Theft & Anomaly Alerts"
        description="Fills that break your rules — impossible volumes, repeat top-ups, and consumption past standard."
      />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <AlertStats />

        <div className="mt-4">
          <AlertQueueCard />
        </div>
      </HydrationBoundary>
    </div>
  );
}
