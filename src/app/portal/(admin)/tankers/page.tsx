import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import { AddTankerButton, RecordIntakeButton } from "@/components/modals/triggers";
import IntakeLogCard from "@/components/tankers/intakeLogCard";
import ReconciliationCard from "@/components/tankers/reconciliationCard";
import TanksSection from "@/components/tankers/tanksSection";
import PageHeader from "@/components/ui/pageHeader";
import { getQueryClient, prefetch } from "@/queries/queryClient";
import { sitesQuery } from "@/queries/siteQueries";
import { intakesQuery, reconciliationQuery, suppliersQuery, tankOptionsQuery, tanksQuery } from "@/queries/tankQueries";
import { accountsQuery } from "@/queries/userQueries";
import { ReconciliationService } from "@/services/reconciliationService";
import { SessionService } from "@/services/sessionService";
import { SiteService } from "@/services/siteService";
import { SupplierService } from "@/services/supplierService";
import { TankIntakeService } from "@/services/tankIntakeService";
import { TankService } from "@/services/tankService";
import { UserService } from "@/services/userService";

export default async function TankersPage() {
  const actor = await SessionService.requireUser();

  // The last four feed the Add Tanker and Record Intake forms, so they open with their selects filled.
  const queryClient = getQueryClient();
  await Promise.all([
    prefetch(queryClient, { ...tanksQuery(), queryFn: () => TankService.listWithLevels() }),
    prefetch(queryClient, { ...reconciliationQuery(), queryFn: () => ReconciliationService.getCurrentReport() }),
    prefetch(queryClient, { ...intakesQuery(), queryFn: () => TankIntakeService.list({ limit: 50 }) }),
    prefetch(queryClient, { ...tankOptionsQuery(), queryFn: () => TankService.listForSelect() }),
    prefetch(queryClient, { ...suppliersQuery(), queryFn: () => SupplierService.list() }),
    prefetch(queryClient, { ...accountsQuery(), queryFn: () => UserService.listAccounts() }),
    prefetch(queryClient, { ...sitesQuery(), queryFn: () => SiteService.list() }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PageHeader
          eyebrow="Administration"
          title="Tankers"
          // description="Bulk stock held on site. Record every delivery taken into a tanker here; equipment draws are recorded on Fuel Entry."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <AddTankerButton />
              <RecordIntakeButton currentUserId={actor.id} />
            </div>
          }
        />

        <div className="mt-7">
          <TanksSection />
        </div>

        <div className="mt-6 space-y-4">
          <ReconciliationCard />
          <IntakeLogCard currentUserId={actor.id} />
        </div>
      </HydrationBoundary>
    </div>
  );
}
