"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bell, CheckCheck, Eye, LoaderCircle, MailCheck, RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ResolveAlertModal from "@/components/modals/resolveAlertModal";
import DataCard from "@/components/ui/dataCard";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { DataCardBodySkeleton } from "@/components/ui/skeleton";
import StatusPill from "@/components/ui/statusPill";
import { useMarkAlertRead, useMarkAllAlertsRead, useReopenAlert, useStartAlertReview } from "@/queries/alertMutations";
import { alertsQuery } from "@/queries/alertQueries";
import type { AlertRow, AlertState } from "@/types/alerts";
import { formatDateTime } from "@/utils/formatDate";
import { alertSeverityStyles, alertStateStyles } from "@/utils/statusUtils";

type Filter = "all" | AlertState;

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "reviewing", label: "Reviewing" },
  { key: "resolved", label: "Resolved" },
];

const RAIL = { critical: "bg-brand-600", high: "bg-brand-500", watch: "bg-amber-400" } as const;

/** Replaces the in-browser read store: read state now lives in `alert_reads`, per user. */
export default function AlertQueueCard() {
  const [filter, setFilter] = useState<Filter>("all");
  const [resolving, setResolving] = useState<AlertRow | null>(null);

  const query = useQuery({
    ...alertsQuery(filter === "all" ? {} : { state: filter }),
    placeholderData: keepPreviousData,
  });
  const alerts = query.data ?? [];
  const unread = alerts.filter((a) => !a.isRead).length;

  const markRead = useMarkAlertRead();
  const markAllRead = useMarkAllAlertsRead();
  const startReview = useStartAlertReview();
  const reopen = useReopenAlert();
  const placeholder = query.isPending ? (
    <DataCardBodySkeleton body="list" rows={5} label="Loading alerts…" />
  ) : query.isError ? (
    <ErrorState what="alerts" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
  ) : (
    alerts.length === 0 && (
      <EmptyState
        icon={ShieldCheck}
        title={filter === "all" ? "No alerts" : `No ${filter} alerts`}
        description={
          filter === "all"
            ? "Nothing looks out of line. Alerts appear here when a fuel entry breaks a consumption or top-up rule."
            : "Try another tab to see the rest of the queue."
        }
      />
    )
  );

  return (
    <>
      <div role="tablist" aria-label="Filter alerts by state" className="mb-4 flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-surface p-1">
        {TABS.map((tab) => {
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                isActive ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <DataCard
        title="Alert queue"
        description="Newest first. Resolving an alert records who cleared it."
        flush
        action={
          query.isSuccess && (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                <Bell className="h-4 w-4 text-brand-500" aria-hidden />
                <span className="tabular-nums">{unread}</span> unread
              </span>
              <button
                type="button"
                onClick={() =>
                  markAllRead.mutate(undefined, {
                    onSuccess: (result) => toast.success("All alerts marked as read", { description: result.message }),
                  })
                }
                disabled={unread === 0 || markAllRead.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-surface px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-surface"
              >
                {markAllRead.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCheck className="h-4 w-4" aria-hidden />}
                Mark all as read
              </button>
            </div>
          )
        }
        emptyState={placeholder}
      >
        <ul className={`divide-y divide-slate-100 ${query.isFetching ? "opacity-60 transition-opacity" : ""}`}>
          {alerts.map((alert) => {
            const isUnread = !alert.isRead;
            const severity = alertSeverityStyles[alert.severity];
            const state = alertStateStyles[alert.state];
            return (
              <li
                key={alert.id}
                className={`relative transition-colors ${isUnread ? "bg-brand-50/40 hover:bg-brand-50/70" : "hover:bg-slate-50/70"}`}
              >
                <span aria-hidden className={`absolute inset-y-0 left-0 w-0.5 ${RAIL[alert.severity]}`} />
                <div className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    {isUnread && (
                      <span className="relative flex h-2 w-2" aria-label="Unread">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-600" />
                      </span>
                    )}
                    <span className={`font-mono text-sm text-slate-900 ${isUnread ? "font-bold" : "font-semibold"}`}>{alert.code}</span>
                    <StatusPill {...severity} />
                    <StatusPill {...state} />
                    <span className="ml-auto font-mono text-xs tabular-nums text-slate-500">{formatDateTime(alert.detectedAt)}</span>
                  </div>

                  <p className={`mt-2 text-sm ${isUnread ? "text-slate-800" : "text-slate-600"}`}>{alert.summary}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    <span className="text-slate-900">
                      <span className="font-mono text-xs text-slate-500">{alert.equipmentCode}</span>{" "}
                      <span className="font-medium">{alert.equipmentName}</span>
                    </span>
                    <span className="text-slate-500">{alert.siteName}</span>
                    {alert.variancePct !== null && (
                      <span className="font-medium tabular-nums text-brand-700">+{alert.variancePct.toFixed(1)}% over standard</span>
                    )}

                    <span className="ml-auto flex flex-wrap items-center gap-2">
                      {alert.state === "open" && (
                        <button
                          type="button"
                          disabled={startReview.isPending}
                          onClick={() =>
                            startReview.mutate(
                              { id: alert.id },
                              { onSuccess: (result) => toast.success(`${alert.code} under review`, { description: result.message }) }
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-surface px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                          Start review
                        </button>
                      )}

                      {alert.state !== "resolved" ? (
                        <button
                          type="button"
                          onClick={() => setResolving(alert)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                          Resolve
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={reopen.isPending}
                          onClick={() =>
                            reopen.mutate(
                              { id: alert.id },
                              {
                                onSuccess: (result) => toast.success(`${alert.code} reopened`, { description: result.message }),
                              }
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-surface px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                          Reopen
                        </button>
                      )}

                      {/* Resolved alerts always count as read, so there's nothing to toggle. */}
                      {alert.state !== "resolved" && (
                        <button
                          type="button"
                          disabled={markRead.isPending}
                          onClick={() => markRead.mutate({ id: alert.id, read: isUnread })}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60"
                        >
                          <MailCheck className="h-3.5 w-3.5" aria-hidden />
                          {isUnread ? "Mark as read" : "Mark as unread"}
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </DataCard>

      {resolving && <ResolveAlertModal open onClose={() => setResolving(null)} alert={resolving} />}
    </>
  );
}
