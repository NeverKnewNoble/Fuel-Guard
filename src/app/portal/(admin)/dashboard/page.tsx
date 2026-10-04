import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import DashboardView from "@/components/dashboard/dashboardView";
import { NewFuelLogEntryButton } from "@/components/modals/triggers";
import PageHeader from "@/components/ui/pageHeader";
import { dashboardOverviewQuery } from "@/queries/dashboardQueries";
import { equipmentOptionsQuery, operatorsQuery } from "@/queries/fuelEntryQueries";
import { getQueryClient, prefetch } from "@/queries/queryClient";
import { sitesQuery } from "@/queries/siteQueries";
import { tankOptionsQuery } from "@/queries/tankQueries";
import { meQuery } from "@/queries/userQueries";
import { DashboardService } from "@/services/dashboardService";
import { EquipmentService } from "@/services/equipmentService";
import { OperatorService } from "@/services/operatorService";
import { SessionService } from "@/services/sessionService";
import { SiteService } from "@/services/siteService";
import { TankService } from "@/services/tankService";
import { formatMonth, monthStart } from "@/services/utils";

export default async function DashboardPage() {
  const actor = await SessionService.requireUser();

  // The option lists feed the New Fuel Log Entry form in the header.
  const queryClient = getQueryClient();
  await Promise.all([
    prefetch(queryClient, { ...dashboardOverviewQuery(), queryFn: () => DashboardService.getOverview(actor) }),
    prefetch(queryClient, { ...equipmentOptionsQuery(), queryFn: () => EquipmentService.listForEntryForm(actor) }),
    prefetch(queryClient, { ...tankOptionsQuery(), queryFn: () => TankService.listForSelect() }),
    prefetch(queryClient, { ...meQuery(), queryFn: async () => ({ ...actor, siteName: actor.siteId ? (await SiteService.getById(actor.siteId)).name : null }) }),
    prefetch(queryClient, { ...sitesQuery(), queryFn: () => SiteService.list() }),
    prefetch(queryClient, { ...operatorsQuery(), queryFn: () => OperatorService.listActive() }),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PageHeader
          eyebrow="Overview"
          title="Dashboard"
          description={formatMonth(monthStart())}
          action={<NewFuelLogEntryButton />}
        />

        <DashboardView />
      </HydrationBoundary>
    </div>
  );
}
