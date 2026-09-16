import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiFetch";
import { queryKeys } from "@/queries/keys";
import type { DashboardOverview } from "@/types/dashboard";

/** The whole page in one request: the service runs its parts in parallel on the server. */
export const dashboardOverviewQuery = () =>
  queryOptions({
    queryKey: [...queryKeys.dashboard.all, "overview"] as const,
    queryFn: () => apiFetch<DashboardOverview>("/api/dashboard"),
  });
