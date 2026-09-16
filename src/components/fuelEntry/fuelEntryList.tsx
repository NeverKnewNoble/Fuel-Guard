"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Ban, ClipboardList, Inbox } from "lucide-react";
import { useState } from "react";

import { FuelEntryRowActions } from "@/components/fuelEntry/fuelEntryRowActions";
import { NewFuelEntryButton } from "@/components/modals/triggers";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { MobileField, MobileFields, MobileList, MobileRecordHeader } from "@/components/ui/mobileList";
import {
  RowCheckbox,
  SelectAllCheckbox,
  SelectableRow,
  SelectionBar,
  SelectionProvider,
} from "@/components/ui/selection";
import { DataCardBodySkeleton } from "@/components/ui/skeleton";
import { fuelEntriesQuery, fuelEntrySummaryQuery } from "@/queries/fuelEntryQueries";
import type { EntryStatus, LogEntryRow } from "@/types/fuelLog";
import { formatDateTime } from "@/utils/formatDate";
import { statusStyles } from "@/utils/fuelEntryUtils";

type Filter = "all" | EntryStatus;

/** The register's download link: the whole tab, or only the rows that are ticked. */
function exportHref(filter: Filter, ids: string[]) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("status", filter);
  for (const id of ids) params.append("id", id);
  const query = params.toString();
  return `/portal/fuel_entry/export${query ? `?${query}` : ""}`;
}

const num = (value: number | null, digits = 0) =>
  value === null ? "—" : value.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** Consumption is only ever quoted on the basis the equipment is measured by. */
const consumption = (entry: LogEntryRow) =>
  entry.basis === "km" ? { value: entry.lPerKm, unit: "L/km", digits: 3 } : { value: entry.lPerHr, unit: "L/hr", digits: 2 };

function StatusCell({ entry }: { entry: LogEntryRow }) {
  if (entry.voidedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
        <Ban className="h-3 w-3 shrink-0" aria-hidden />
        Void
      </span>
    );
  }
  const status = statusStyles[entry.status];
  const Icon = status.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {status.shortLabel}
    </span>
  );
}

export default function FuelEntryList({ isAdmin }: { isAdmin: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");

  const summary = useQuery(fuelEntrySummaryQuery());
  const query = useQuery({
    ...fuelEntriesQuery(filter === "all" ? {} : { status: filter }),
    // Keep the current rows on screen while the new tab loads, instead of flashing a skeleton.
    placeholderData: keepPreviousData,
  });
  const entries = query.data ?? [];

  const counts = summary.data;
  const tabs: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "All", count: counts?.total },
    { key: "flagged", label: "Flagged", count: counts?.flagged },
    { key: "watch", label: "Watch", count: counts?.watch },
    { key: "locked", label: "Locked", count: counts?.locked },
  ];

  return (
    <>
      {/* Toolbar: filters left, primary action far right */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Filter entries by status"
          className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1"
        >
          {tabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isActive ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                    isActive ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tab.count ?? "—"}
                </span>
              </button>
            );
          })}
        </div>

        <NewFuelEntryButton />
      </div>

      <SelectionProvider ids={entries.map((e) => e.id)}>
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{isAdmin ? "Daily fuel log" : "My fuel log"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isAdmin
                  ? "Every fill recorded across all sites, with meter readings and consumption. Corrections need your approval."
                  : "Your recorded fills, with meter readings and consumption. Corrections require administrator approval."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Entries are voided, never deleted, so there's no bulk Delete. */}
              {query.isSuccess && (
                <SelectionBar
                  noun="entry"
                  plural="entries"
                  actions={["export"]}
                  onExport={(ids, clear) => {
                    window.location.href = exportHref(filter, ids);
                    clear();
                  }}
                />
              )}
              {query.isSuccess && entries.length > 0 && (
                <a
                  href={exportHref(filter, [])}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Export log
                </a>
              )}
            </div>
          </header>

          {query.isPending ? (
            <DataCardBodySkeleton rows={6} columns={6} label="Loading entries…" />
          ) : query.isError ? (
            <ErrorState what="fuel entries" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
          ) : entries.length === 0 ? (
            filter === "all" ? (
              <EmptyState
                icon={ClipboardList}
                title="No fuel entries yet"
                description="Record a fill at the pump and it will appear here with its meter readings and consumption."
                action={<NewFuelEntryButton />}
              />
            ) : (
              <EmptyState
                icon={Inbox}
                title={`No ${filter} entries`}
                description="Try another filter, or choose All to see every entry."
              />
            )
          ) : (
            <>
              <MobileList>
                {entries.map((entry) => {
                  const rate = consumption(entry);
                  return (
                    <SelectableRow
                      key={entry.id}
                      id={entry.id}
                      as="li"
                      className={`px-5 py-4 sm:px-6 ${entry.voidedAt ? "opacity-70" : ""}`}
                    >
                      <MobileRecordHeader
                        select={<RowCheckbox id={entry.id} label={entry.code} />}
                        title={
                          <>
                            <span className={`font-mono ${entry.voidedAt ? "line-through" : ""}`}>{entry.equipmentCode}</span> ·{" "}
                            {entry.equipmentType}
                          </>
                        }
                        subtitle={`${entry.operatorName} · ${entry.siteName}`}
                        trailing={
                          <>
                            <StatusCell entry={entry} />
                            <FuelEntryRowActions entry={entry} isAdmin={isAdmin} />
                          </>
                        }
                      />
                      <MobileFields>
                        <MobileField label="Qty (L)">
                          <span className="font-semibold tabular-nums text-slate-900">{entry.litres.toLocaleString()}</span>
                        </MobileField>
                        <MobileField label={entry.basis === "km" ? "Total km" : "Total hours"}>
                          <span className="tabular-nums">{num(entry.basis === "km" ? entry.totalKm : entry.totalHours, 1)}</span>
                        </MobileField>
                        <MobileField label={rate.unit}>
                          <span className="tabular-nums">{num(rate.value, rate.digits)}</span>
                        </MobileField>
                        <MobileField label={entry.basis === "km" ? "ODM start → end" : "HM start → end"}>
                          <span className="tabular-nums">
                            {entry.basis === "km"
                              ? `${num(entry.odometerStart, 1)} → ${num(entry.odometerEnd, 1)}`
                              : `${num(entry.hourMeterStart, 1)} → ${num(entry.hourMeterEnd, 1)}`}
                          </span>
                        </MobileField>
                        <MobileField label="Location & activity" className="col-span-2 sm:col-span-1">
                          {entry.locationActivity || "—"}
                        </MobileField>
                        <MobileField label="Logged">
                          <span className="font-mono text-xs tabular-nums">{formatDateTime(entry.dispensedAt)}</span>
                        </MobileField>
                      </MobileFields>
                      <p className="mt-2 text-xs text-slate-400">Recorded by {entry.recordedBy}</p>
                    </SelectableRow>
                  );
                })}
              </MobileList>

              {/* The register itself: the client's sheet, column for column. Scrolls sideways, never the page. */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[80rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-400">
                      <th scope="col" className="w-10 px-5 py-2.5 text-left sm:px-6">
                        <SelectAllCheckbox label="entries" />
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Date</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Equipment</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Driver / operator</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Qty (L)</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Meter start</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Meter end</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Total</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Consumption</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-semibold">Location &amp; activity</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Status</th>
                      <th scope="col" className="w-12 px-5 py-2.5 text-right font-semibold sm:px-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y divide-slate-100 ${query.isFetching ? "opacity-60 transition-opacity" : ""}`}>
                    {entries.map((entry) => {
                      const km = entry.basis === "km";
                      const rate = consumption(entry);
                      return (
                        <SelectableRow
                          key={entry.id}
                          id={entry.id}
                          className={`transition-colors hover:bg-slate-50/70 ${entry.voidedAt ? "opacity-70" : ""}`}
                        >
                          <td className="px-5 py-3.5 sm:px-6">
                            <RowCheckbox id={entry.id} label={entry.code} />
                          </td>
                          <td className="px-3 py-3.5 font-mono text-xs tabular-nums whitespace-nowrap text-slate-500">
                            {formatDateTime(entry.dispensedAt)}
                          </td>
                          <td className="px-3 py-3.5">
                            <span className={`block font-mono text-sm font-semibold text-slate-900 ${entry.voidedAt ? "line-through" : ""}`}>
                              {entry.equipmentCode}
                            </span>
                            <span className="block text-xs text-slate-500">{entry.equipmentType}</span>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className="block text-slate-700">{entry.operatorName}</span>
                            <span className="block text-xs text-slate-400">{entry.siteName}</span>
                          </td>
                          <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-slate-900">
                            {entry.litres.toLocaleString()}
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-slate-500">
                            {num(km ? entry.odometerStart : entry.hourMeterStart, 1)}
                            <span className="ml-1 text-xs font-normal text-slate-400">{km ? "km" : "hr"}</span>
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-slate-500">
                            {num(km ? entry.odometerEnd : entry.hourMeterEnd, 1)}
                            <span className="ml-1 text-xs font-normal text-slate-400">{km ? "km" : "hr"}</span>
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-slate-700">
                            {num(km ? entry.totalKm : entry.totalHours, 1)}
                            <span className="ml-1 text-xs font-normal text-slate-400">{km ? "km" : "hrs"}</span>
                          </td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-slate-700">
                            {num(rate.value, rate.digits)}
                            <span className="ml-1 text-xs font-normal text-slate-400">{rate.unit}</span>
                          </td>
                          <td className="max-w-56 px-3 py-3.5 text-slate-600">
                            <span className="block truncate" title={entry.locationActivity || undefined}>
                              {entry.locationActivity || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            <StatusCell entry={entry} />
                          </td>
                          <td className="px-5 py-3.5 text-right sm:px-6">
                            <FuelEntryRowActions entry={entry} isAdmin={isAdmin} />
                          </td>
                        </SelectableRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </SelectionProvider>
    </>
  );
}
