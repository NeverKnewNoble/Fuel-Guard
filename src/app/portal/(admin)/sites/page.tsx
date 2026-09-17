import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import { AddSiteButton } from "@/components/setup/setupTriggers";
import SitesCard from "@/components/setup/sitesCard";
import PageHeader from "@/components/ui/pageHeader";
import { getQueryClient, prefetch } from "@/queries/queryClient";
import { sitesUsageQuery } from "@/queries/setupQueries";
import { SiteService } from "@/services/siteService";

export default async function SitesPage() {
  const queryClient = getQueryClient();
  await prefetch(queryClient, {
    ...sitesUsageQuery(),
    queryFn: () => SiteService.listWithUsage({ includeArchived: true }),
  });

  return (
    <div className="mx-auto w-full max-w-5xl">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PageHeader
          eyebrow="Set-up"
          title="Sites"
          // description="The places work happens. Every unit, tanker, records taker and fuel entry belongs to one."
          action={<AddSiteButton />}
        />

        <div className="mt-7">
          <SitesCard />
        </div>
      </HydrationBoundary>
    </div>
  );
}
