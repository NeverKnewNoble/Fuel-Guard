"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Ban, ClipboardList, Inbox } from "lucide-react";
import { useState } from "react";

import { FuelEntryRowActions } from "@/components/fuelEntry/fuelEntryRowActions";
import { NewFuelEntryButton } from "@/components/modals/triggers";
import {
  DetailGroup,
  DetailItem,
  DetailPanel,
  ExpandButton,
  useDisclosure,
} from "@/components/ui/detailDisclosure";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { MobileList, MobileRecordHeader } from "@/components/ui/mobileList";
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
const consumptionOf = (entry: LogEntryRow) =>
  entry.basis === "km"
    ? { value: entry.lPerKm, unit: "L/km", digits: 3 }
    : { value: entry.lPerHr, unit: "L/hr", digits: 2 };

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

/**
 * Everything the row itself doesn't show. The meter readings follow the equipment's basis, so a
 * truck shows kilometres and a dozer shows hours — never both, never empty columns.
 */
function EntryDetails({ entry, id, flush = false }: { entry: LogEntryRow; id: string; flush?: boolean }) {
  const km = entry.basis === "km";
  const rate = consumptionOf(entry);
  return (
    <DetailPanel id={id} flush={flush}>
      <DetailGroup title={km ? "Odometer" : "Hour meter"}>
        <DetailItem label="Reading start">{num(km ? entry.odometerStart : entry.hourMeterStart, 1)}</DetailItem>
        <DetailItem label="Reading end">{num(km ? entry.odometerEnd : entry.hourMeterEnd, 1)}</DetailItem>
        <DetailItem label={km ? "Total km done" : "Total hours done"} emphasis>
          {num(km ? entry.totalKm : entry.totalHours, 1)}
        </DetailItem>
      </DetailGroup>

      <DetailGroup title="Consumption">
        <DetailItem label={rate.unit} emphasis>
          {num(rate.value, rate.digits)}
        </DetailItem>
        <DetailItem label="Quantity issued">{entry.litres.toLocaleString()} L</DetailItem>
        <DetailItem label="Equipment type">{entry.equipmentType}</DetailItem>
      </DetailGroup>

      <DetailGroup title="Record">
        <DetailItem label="Location & activity">{entry.locationActivity || "—"}</DetailItem>
        <DetailItem label="Site">{entry.siteName}</DetailItem>
        <DetailItem label="Recorded by">{entry.recordedBy}</DetailItem>
        <DetailItem label="Entry">{entry.code}</DetailItem>
      </DetailGroup>
    </DetailPanel>
  );
}

/** A table row and, when open, the panel underneath it. */
function EntryRow({ entry, isAdmin, columns }: { entry: LogEntryRow; isAdmin: boolean; columns: number }) {
  const details = useDisclosure();
  const rate = consumptionOf(entry);

  return (
    <>
      <SelectableRow
        id={entry.id}
        className={`transition-colors hover:bg-slate-50/70 ${entry.voidedAt ? "opacity-70" : ""}`}
      >
        <td className="px-5 py-4 sm:px-6">
          <RowCheckbox id={entry.id} label={entry.code} />
        </td>
        <td className="px-3 py-4 whitespace-nowrap tabular-nums text-slate-500">{formatDateTime(entry.dispensedAt)}</td>
        <td className="px-3 py-4">
          <span className={`block font-medium text-slate-900 ${entry.voidedAt ? "line-through" : ""}`}>
            {entry.equipmentCode}
          </span>
          <span className="block text-sm text-slate-500">{entry.equipmentType}</span>
        </td>
        <td className="px-3 py-4 text-slate-700">{entry.operatorName}</td>
        <td className="px-3 py-4 text-right">
          <span className="font-semibold tabular-nums text-slate-900">{entry.litres.toLocaleString()}</span>
          <span className="ml-1 text-slate-400">L</span>
        </td>
        <td className="px-3 py-4 text-right">
          <span className="tabular-nums text-slate-700">{num(rate.value, rate.digits)}</span>
          <span className="ml-1 text-slate-400">{rate.unit}</span>
        </td>
        <td className="px-3 py-4 text-right">
          <StatusCell entry={entry} />
        </td>
        <td className="px-5 py-4 sm:px-6">
          <div className="flex items-center justify-end gap-1">
            <ExpandButton {...details.buttonProps} label={`details for ${entry.code}`} />
            <FuelEntryRowActions entry={entry} isAdmin={isAdmin} />
          </div>
        </td>
      </SelectableRow>
      {details.open && (
        <tr>
          <td colSpan={columns} className="p-0">
            <EntryDetails entry={entry} id={details.panelId} flush />
          </td>
        </tr>
      )}
    </>
  );
}

/** The same record as a card, for screens too narrow for the table. */
function EntryCard({ entry, isAdmin }: { entry: LogEntryRow; isAdmin: boolean }) {
  const details = useDisclosure();
  const rate = consumptionOf(entry);

  return (
    <SelectableRow id={entry.id} as="li" className={entry.voidedAt ? "opacity-70" : ""}>
      <div className="px-5 py-4 sm:px-6">
        <MobileRecordHeader
          select={<RowCheckbox id={entry.id} label={entry.code} />}
          title={<span className={entry.voidedAt ? "line-through" : ""}>{entry.equipmentCode}</span>}
          subtitle={`${entry.operatorName} · ${entry.equipmentType}`}
          trailing={
            <>
              <StatusCell entry={entry} />
              <FuelEntryRowActions entry={entry} isAdmin={isAdmin} />
            </>
          }
        />
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl font-semibold tabular-nums text-slate-900">{entry.litres.toLocaleString()}</span>
          <span className="text-slate-400">L</span>
          <span className="ml-auto text-sm tabular-nums text-slate-500">{formatDateTime(entry.dispensedAt)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-500">
            {num(rate.value, rate.digits)} <span className="text-slate-400">{rate.unit}</span>
          </span>
          <ExpandButton {...details.buttonProps} label={`details for ${entry.code}`} variant="text" />
        </div>
      </div>
      {details.open && <EntryDetails entry={entry} id={details.panelId} />}
    </SelectableRow>
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

  const COLUMNS = 8;

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
                  className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
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
              <h2 className="text-lg font-semibold text-slate-900">{isAdmin ? "Daily fuel log" : "My fuel log"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isAdmin
                  ? "Every fill recorded across all sites. Open a row for its meter readings."
                  : "Your recorded fills. Open a row for its meter readings."}
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
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
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
                {entries.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} isAdmin={isAdmin} />
                ))}
              </MobileList>

              {/* Six columns you scan by; the meter readings and the rest live behind each row's chevron. */}
              <div className="hidden lg:block">
                <table className="w-full border-collapse text-[15px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wider text-slate-400">
                      <th scope="col" className="w-10 px-5 py-3 text-left sm:px-6">
                        <SelectAllCheckbox label="entries" />
                      </th>
                      <th scope="col" className="px-3 py-3 text-left font-semibold">Date</th>
                      <th scope="col" className="px-3 py-3 text-left font-semibold">Equipment</th>
                      <th scope="col" className="px-3 py-3 text-left font-semibold">Driver / operator</th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">Quantity</th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">Consumption</th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">Status</th>
                      <th scope="col" className="w-24 px-5 py-3 text-right font-semibold sm:px-6">
                        <span className="sr-only">Details and actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y divide-slate-100 ${query.isFetching ? "opacity-60 transition-opacity" : ""}`}>
                    {entries.map((entry) => (
                      <EntryRow key={entry.id} entry={entry} isAdmin={isAdmin} columns={COLUMNS} />
                    ))}
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
