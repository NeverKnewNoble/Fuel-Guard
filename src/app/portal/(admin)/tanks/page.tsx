import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import { AddTankButton, RecordIntakeButton, TransferFuelButton } from "@/components/modals/triggers";
import IntakeLogCard from "@/components/tanks/intakeLogCard";
import ReconciliationCard from "@/components/tanks/reconciliationCard";
import TanksSection from "@/components/tanks/tanksSection";
import TransferLogCard from "@/components/tanks/transferLogCard";
import PageHeader from "@/components/ui/pageHeader";
import { getQueryClient, prefetch } from "@/queries/queryClient";
import { sitesQuery } from "@/queries/siteQueries";
import { intakesQuery, reconciliationQuery, suppliersQuery, tankOptionsQuery, tanksQuery, transfersQuery } from "@/queries/tankQueries";
import { accountsQuery } from "@/queries/userQueries";
import { ReconciliationService } from "@/services/reconciliationService";
import { SessionService } from "@/services/sessionService";
import { SiteService } from "@/services/siteService";
import { SupplierService } from "@/services/supplierService";
import { TankIntakeService } from "@/services/tankIntakeService";
import { TankService } from "@/services/tankService";
import { TankTransferService } from "@/services/tankTransferService";
import { UserService } from "@/services/userService";

export default async function TanksPage() {
  const actor = await SessionService.requireUser();

  // The last four feed the Add Tank, Transfer Fuel and Record Intake forms, so they open with their selects filled.
  const queryClient = getQueryClient();
  await Promise.all([
    prefetch(queryClient, { ...tanksQuery(), queryFn: () => TankService.listWithLevels() }),
    prefetch(queryClient, { ...reconciliationQuery(), queryFn: () => ReconciliationService.getCurrentReport() }),
    prefetch(queryClient, { ...intakesQuery(), queryFn: () => TankIntakeService.list({ limit: 50 }) }),
    prefetch(queryClient, { ...transfersQuery(), queryFn: () => TankTransferService.list({ limit: 50 }) }),
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
          title="Tanks"
          // description="Bulk stock held on site. Record every delivery taken into a tank here; equipment draws are recorded on Fuel Entry."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <AddTankButton />
              <TransferFuelButton />
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
          <TransferLogCard />
        </div>
      </HydrationBoundary>
    </div>
  );
}
