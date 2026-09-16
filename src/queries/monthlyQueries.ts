import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiFetch";
import { queryKeys } from "@/queries/keys";
import type { MonthlyReport } from "@/types/monthly";
import type { ReportingPeriodListItem } from "@/types/period";

export const reportingPeriodsQuery = () =>
  queryOptions({
    queryKey: queryKeys.reportingPeriods.list(),
    queryFn: () => apiFetch<ReportingPeriodListItem[]>("/api/reporting_periods"),
  });

export const monthlyReportQuery = (periodId: string) =>
  queryOptions({
    queryKey: queryKeys.monthlySummary.report(periodId),
    queryFn: () => apiFetch<MonthlyReport>(`/api/monthly_summary/${encodeURIComponent(periodId)}`),
  });
