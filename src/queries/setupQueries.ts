import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiFetch";
import { queryKeys } from "@/queries/keys";
import type { OperatorRow } from "@/types/operator";
import type { SiteUsageRow } from "@/types/site";

/** The Sites page: every site, archived included, with what's based there. */
export const sitesUsageQuery = () =>
  queryOptions({
    queryKey: queryKeys.sites.usage(),
    queryFn: () => apiFetch<SiteUsageRow[]>("/api/sites/usage"),
  });

/** The Operators page: everyone, deactivated included. The New Fuel Entry form uses `operatorsQuery` instead. */
export const allOperatorsQuery = () =>
  queryOptions({
    queryKey: queryKeys.operators.all,
    queryFn: () => apiFetch<OperatorRow[]>("/api/operators/all"),
  });
