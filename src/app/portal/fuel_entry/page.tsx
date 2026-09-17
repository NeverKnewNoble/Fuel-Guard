import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import FuelEntryList from "@/components/fuelEntry/fuelEntryList";
import FuelEntrySummary from "@/components/fuelEntry/fuelEntrySummary";
import PendingCorrectionsCard from "@/components/fuelEntry/pendingCorrectionsCard";
import { SUMMARY_DAYS } from "@/app/api/fuel_entries/summary/route";
import {
  equipmentOptionsQuery,
  fuelEntriesQuery,
  fuelEntrySummaryQuery,
  operatorsQuery,
  pendingCorrectionsQuery,
} from "@/queries/fuelEntryQueries";
import { getQueryClient, prefetch } from "@/queries/queryClient";
import { sitesQuery } from "@/queries/siteQueries";
import { tankOptionsQuery } from "@/queries/tankQueries";
import { meQuery } from "@/queries/userQueries";
import { EquipmentService } from "@/services/equipmentService";
import { FuelEntryCorrectionService } from "@/services/fuelEntryCorrectionService";
import { FuelEntryService } from "@/services/fuelEntryService";
import { OperatorService } from "@/services/operatorService";
import { SessionService } from "@/services/sessionService";
import { SiteService } from "@/services/siteService";
import { TankService } from "@/services/tankService";

export default async function FuelEntryPage() {
  const actor = await SessionService.requireUser();
  const isAdmin = SessionService.isAdmin(actor);

  // The option lists feed the New Fuel Entry form, so it opens with its selects filled.
  const queryClient = getQueryClient();
  await Promise.all([
    prefetch(queryClient, { ...fuelEntriesQuery(), queryFn: () => FuelEntryService.listRecent({ actor }) }),
    prefetch(queryClient, {
      ...fuelEntrySummaryQuery(),
      queryFn: () => FuelEntryService.getSummary({ actor, since: new Date(Date.now() - SUMMARY_DAYS * 24 * 60 * 60 * 1000) }),
    }),
    prefetch(queryClient, { ...equipmentOptionsQuery(), queryFn: () => EquipmentService.listForEntryForm(actor) }),
    prefetch(queryClient, { ...tankOptionsQuery(), queryFn: () => TankService.listForSelect() }),
    prefetch(queryClient, { ...meQuery(), queryFn: async () => ({ ...actor, siteName: actor.siteId ? (await SiteService.getById(actor.siteId)).name : null }) }),
    prefetch(queryClient, { ...sitesQuery(), queryFn: () => SiteService.list() }),
    prefetch(queryClient, {
      ...operatorsQuery(),
      queryFn: () => OperatorService.listActive({ siteId: isAdmin ? undefined : actor.siteId }),
    }),
    ...(isAdmin
      ? [prefetch(queryClient, { ...pendingCorrectionsQuery(), queryFn: () => FuelEntryCorrectionService.listPending(actor) })]
      : []),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Recording</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Fuel Entry</h1>
        {/*
        <p className="mt-2 max-w-2xl text-sm text-slate-500 sm:text-base">
          Capture fills at the pump and review what you&apos;ve already submitted.
        </p>
        */}
      </header>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <FuelEntrySummary />

        {isAdmin && (
          <div className="mt-4">
            <PendingCorrectionsCard />
          </div>
        )}

        <FuelEntryList isAdmin={isAdmin} />
      </HydrationBoundary>
    </div>
  );
}
