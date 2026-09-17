import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import OperatorsCard from "@/components/setup/operatorsCard";
import { AddOperatorButton } from "@/components/setup/setupTriggers";
import PageHeader from "@/components/ui/pageHeader";
import { getQueryClient, prefetch } from "@/queries/queryClient";
import { sitesQuery } from "@/queries/siteQueries";
import { allOperatorsQuery } from "@/queries/setupQueries";
import { accountsQuery } from "@/queries/userQueries";
import { OperatorService } from "@/services/operatorService";
import { SiteService } from "@/services/siteService";
import { UserService } from "@/services/userService";

export default async function OperatorsPage() {
  // Sites and accounts feed the Add Operator form's selects.
  const queryClient = getQueryClient();
  await Promise.all([
    prefetch(queryClient, { ...allOperatorsQuery(), queryFn: () => OperatorService.list({ includeInactive: true }) }),
    prefetch(queryClient, { ...sitesQuery(), queryFn: () => SiteService.list() }),
    prefetch(queryClient, { ...accountsQuery(), queryFn: () => UserService.listAccounts() }),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PageHeader
          eyebrow="Set-up"
          title="Drivers & Operators"
          // description="The people who draw fuel. Every fuel entry records who was operating the equipment."
          action={<AddOperatorButton />}
        />

        <div className="mt-7">
          <OperatorsCard />
        </div>
      </HydrationBoundary>
    </div>
  );
}
