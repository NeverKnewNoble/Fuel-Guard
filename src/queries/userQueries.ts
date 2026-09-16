import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiFetch";
import { queryKeys } from "@/queries/keys";
import type { AccountRow, AccountStats } from "@/types/account";
import type { CurrentUser } from "@/types/user";

/** Who's signed in, for forms that default to their site. Changes only at sign-in. */
export const meQuery = () =>
  queryOptions({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<CurrentUser>("/api/me"),
  });

export const accountsQuery = () =>
  queryOptions({
    queryKey: queryKeys.users.list(),
    queryFn: () => apiFetch<AccountRow[]>("/api/users"),
  });

export const accountStatsQuery = () =>
  queryOptions({
    queryKey: queryKeys.users.stats(),
    queryFn: () => apiFetch<AccountStats>("/api/users/stats"),
  });
