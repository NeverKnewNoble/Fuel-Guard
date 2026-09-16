import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import MonthlySummaryView from "@/components/monthly/monthlySummaryView";
import { monthlyReportQuery, reportingPeriodsQuery } from "@/queries/monthlyQueries";
import { getQueryClient, prefetch } from "@/queries/queryClient";
import { MonthlySummaryService } from "@/services/monthlySummaryService";
import { ReportingPeriodService } from "@/services/reportingPeriodService";

export default async function MonthlySummaryPage() {
  // The page opens on the current month; `getCurrent` creates its period row the first time.
  const current = await ReportingPeriodService.getCurrent();

  const queryClient = getQueryClient();
  await Promise.all([
    prefetch(queryClient, { ...reportingPeriodsQuery(), queryFn: () => ReportingPeriodService.list() }),
    prefetch(queryClient, { ...monthlyReportQuery(current.id), queryFn: () => MonthlySummaryService.getReport(current.id) }),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MonthlySummaryView initialPeriodId={current.id} />
      </HydrationBoundary>
    </div>
  );
}
