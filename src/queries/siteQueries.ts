import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiFetch";
import { queryKeys } from "@/queries/keys";
import type { SiteOption } from "@/types/site";

export const sitesQuery = () =>
  queryOptions({
    queryKey: queryKeys.sites.list(),
    queryFn: () => apiFetch<SiteOption[]>("/api/sites"),
  });
