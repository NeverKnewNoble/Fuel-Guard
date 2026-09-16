import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import { CreateUserButton } from "@/components/modals/triggers";
import PageHeader from "@/components/ui/pageHeader";
import AccountStats from "@/components/users/accountStats";
import AccountsCard from "@/components/users/accountsCard";
import { getQueryClient, prefetch } from "@/queries/queryClient";
import { sitesQuery } from "@/queries/siteQueries";
import { accountStatsQuery, accountsQuery } from "@/queries/userQueries";
import { SessionService } from "@/services/sessionService";
import { SiteService } from "@/services/siteService";
import { UserService } from "@/services/userService";

export default async function UsersAndRolesPage() {
  const actor = await SessionService.requireUser();

  // Sites feed the Create User and Change role forms.
  const queryClient = getQueryClient();
  await Promise.all([
    prefetch(queryClient, { ...accountsQuery(), queryFn: () => UserService.listAccounts() }),
    prefetch(queryClient, { ...accountStatsQuery(), queryFn: () => UserService.getStats() }),
    prefetch(queryClient, { ...sitesQuery(), queryFn: () => SiteService.list() }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PageHeader
          eyebrow="Set-up"
          title="Users & Roles"
          description="Decide who records fuel and who reviews it. Record takers can submit entries but never amend them."
          action={<CreateUserButton />}
        />

        <AccountStats />

        <div className="mt-4">
          <AccountsCard currentUserId={actor.id} />
        </div>
      </HydrationBoundary>
    </div>
  );
}
