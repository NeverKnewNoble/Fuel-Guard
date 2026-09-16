import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiFetch";
import { queryKeys } from "@/queries/keys";
import type { AlertCounts, AlertRow, AlertState } from "@/types/alerts";

export const alertsQuery = (filters: { state?: AlertState } = {}) =>
  queryOptions({
    queryKey: queryKeys.alerts.list(filters),
    queryFn: () => apiFetch<AlertRow[]>(`/api/alerts${filters.state ? `?state=${filters.state}` : ""}`),
  });

export const alertCountsQuery = () =>
  queryOptions({
    queryKey: queryKeys.alerts.counts(),
    queryFn: () => apiFetch<AlertCounts>("/api/alerts/counts"),
  });

/** The sidebar badge. Kept fresher than most queries, since it's the signal that something needs attention. */
export const unreadAlertsQuery = () =>
  queryOptions({
    queryKey: queryKeys.alerts.unreadCount(),
    queryFn: () => apiFetch<number>("/api/alerts/unread_count"),
    staleTime: 30 * 1000,
  });
