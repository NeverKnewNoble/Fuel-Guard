import { QueryClient, isServer, type QueryExecuteOptions, type QueryKey } from "@tanstack/react-query";
import { ApiError } from "@/queries/apiFetch";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * Data counts as fresh for 25 minutes: opening a page again inside that window shows the
         * cached copy with no request. Your own saves still appear at once, because every mutation
         * invalidates the queries it affects (see `useActionMutation`). Someone else's changes can
         * take up to 25 minutes to show, unless the tab is refocused after that or a save refreshes them.
         */
        staleTime: 25 * 60 * 1000,
        // Keep it a little longer than that, or unused data would be dropped (default 5 min) and refetched anyway.
        gcTime: 30 * 60 * 1000,
        // Retry network and server errors, but not "not found", "forbidden" or "sign in again".
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * On the server, a new client per call, so one user's data never leaks into another's request.
 * In the browser, one client for the whole session, so the cache survives navigation.
 */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

/**
 * Warms the cache for a server render, e.g.
 *   await Promise.all([prefetch(queryClient, { ...sitesQuery(), queryFn: () => SiteService.list() })])
 *
 * Failures are swallowed on purpose: the client component fetches it again and shows its own error state.
 * (`queryClient.prefetchQuery` did this too, but it's deprecated in favour of `query`.)
 */
export function prefetch<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = never,
>(
  queryClient: QueryClient,
  options: QueryExecuteOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey, TPageParam>
): Promise<TData | undefined> {
  return queryClient.query(options).catch(() => undefined);
}
