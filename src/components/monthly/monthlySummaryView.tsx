"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Banknote, Download, Droplets, FileSpreadsheet, Lock, LockOpen, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/modals/confirmDialog";
import DataCard from "@/components/ui/dataCard";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { MobileField, MobileFields, MobileList, MobileRecordHeader } from "@/components/ui/mobileList";
import PageHeader from "@/components/ui/pageHeader";
import {
  RowCheckbox,
  SelectAllBar,
  SelectAllCheckbox,
  SelectableRow,
  SelectionBar,
  SelectionProvider,
} from "@/components/ui/selection";
import { DataCardBodySkeleton, StatTilesSkeleton } from "@/components/ui/skeleton";
import StatTile from "@/components/ui/statTile";
import StatusPill from "@/components/ui/statusPill";
import { useClosePeriod, useReopenPeriod } from "@/queries/monthlyMutations";
import { monthlyReportQuery, reportingPeriodsQuery } from "@/queries/monthlyQueries";
import { dash, formatVariance, varianceStatusStyles, varianceToneClass } from "@/utils/statusUtils";

const TILE_GRID = "mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3";

const exportHref = (periodId: string, equipmentIds: string[] = []) =>
  `/portal/monthly_summary/export?period=${encodeURIComponent(periodId)}${equipmentIds.map((id) => `&equipment=${encodeURIComponent(id)}`).join("")}`;

export default function MonthlySummaryView({ initialPeriodId }: { initialPeriodId: string }) {
  const [periodId, setPeriodId] = useState(initialPeriodId);
  const [dialog, setDialog] = useState<"close" | "reopen" | null>(null);

  const periods = useQuery(reportingPeriodsQuery());
  const report = useQuery({ ...monthlyReportQuery(periodId), placeholderData: keepPreviousData });

  const period = periods.data?.find((p) => p.id === periodId);
  const rows = report.data?.rows ?? [];
  const totals = report.data?.totals;
  const closed = period?.status === "closed";

  const closePeriod = useClosePeriod();
  const reopenPeriod = useReopenPeriod();
  const periodMutation = closed ? reopenPeriod : closePeriod;
  const closeDialog = () => {
    setDialog(null);
    periodMutation.reset();
  };

  const tablePlaceholder = report.isPending ? (
    <DataCardBodySkeleton rows={6} columns={10} label="Loading the monthly breakdown…" />
  ) : report.isError ? (
    <ErrorState what="the monthly summary" message={report.error.message} onRetry={() => report.refetch()} retrying={report.isFetching} />
  ) : (
    rows.length === 0 && (
      <EmptyState
        icon={FileSpreadsheet}
        title="Nothing to summarise for this month"
        description="Rows appear once equipment is registered. Units with no fuel entries this month show 0 L."
      />
    )
  );

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title={`Monthly Summary${period ? ` — ${period.label}` : ""}`}
        description="All sites · all equipment, measured against consumption standards."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="ms-period">
              Month
            </label>
            <select
              id="ms-period"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              disabled={periods.isPending}
              className="h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              {periods.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.status === "closed" ? " (closed)" : ""}
                </option>
              ))}
            </select>

            <a
              href={exportHref(periodId)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              Export CSV
            </a>

            <button
              type="button"
              onClick={() => setDialog(closed ? "reopen" : "close")}
              disabled={!period}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-brand-500"
            >
              {closed ? <LockOpen className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
              {closed ? "Reopen month" : "Close month"}
            </button>
          </div>
        }
      />

      {report.isPending ? (
        <StatTilesSkeleton count={3} className={TILE_GRID} />
      ) : (
        <dl className={TILE_GRID}>
          <StatTile
            label="Total fuel issued"
            value={`${(totals?.totalLitres ?? 0).toLocaleString()} L`}
            hint={period?.label ?? "This month"}
            icon={Droplets}
          />
          <StatTile label="Total cost" value={`GHS ${(totals?.totalCostGhs ?? 0).toLocaleString()}`} hint="All sites" icon={Banknote} />
          <StatTile
            label="Flagged units"
            value={(totals?.flaggedUnits ?? 0).toLocaleString()}
            hint="Above standard variance"
            icon={TriangleAlert}
            accent="text-brand-500"
          />
        </dl>
      )}

      <div className="mt-4">
        <SelectionProvider ids={rows.map((r) => r.equipmentId)}>
          <DataCard
            title="Per-equipment breakdown"
            description="Consumption averages and variance against each unit's standard."
            flush
            action={
              report.isSuccess && (
                <SelectionBar
                  noun="row"
                  actions={["export"]}
                  onExport={(ids, clear) => {
                    window.location.href = exportHref(periodId, ids);
                    clear();
                  }}
                />
              )
            }
            emptyState={tablePlaceholder}
          >
            <SelectAllBar label="rows" />
            <MobileList>
              {rows.map((row) => {
                const status = varianceStatusStyles[row.status];
                const variance = row.varLHr ?? row.varLKm;
                const perHour = row.basis === "hours";
                return (
                  <SelectableRow key={row.equipmentId} id={row.equipmentId} as="li" className="px-5 py-4 sm:px-6">
                    <MobileRecordHeader
                      select={<RowCheckbox id={row.equipmentId} label={row.equipmentCode} />}
                      title={<><span className="font-mono">{row.equipmentCode}</span> · {row.type}</>}
                      subtitle={row.site}
                      trailing={<StatusPill {...status} />}
                    />
                    <MobileFields>
                      <MobileField label="Qty (L)"><span className="tabular-nums text-slate-900">{row.qtyL.toLocaleString()}</span></MobileField>
                      <MobileField label="Cost (GHS)"><span className="tabular-nums text-slate-900">{row.costGhs.toLocaleString()}</span></MobileField>
                      <MobileField label={perHour ? "Hours" : "Km"}>
                        <span className="tabular-nums">{(perHour ? row.hours : row.km)?.toLocaleString() ?? "—"}</span>
                      </MobileField>
                      <MobileField label={`Avg / std (${perHour ? "L/hr" : "L/km"})`}>
                        <span className="tabular-nums">
                          {dash(perHour ? row.lHrAvg : row.lKmAvg, perHour ? 2 : 3)} / {dash(perHour ? row.lHrStd : row.lKmStd, perHour ? 2 : 3)}
                        </span>
                      </MobileField>
                      <MobileField label="Variance">
                        <span className={`font-medium tabular-nums ${varianceToneClass(variance)}`}>{formatVariance(variance)}</span>
                      </MobileField>
                    </MobileFields>
                  </SelectableRow>
                );
              })}
            </MobileList>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-260 border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-400">
                    <th scope="col" className="w-10 px-5 py-2.5 text-left sm:px-6">
                      <SelectAllCheckbox label="rows" />
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left font-semibold">Equipment</th>
                    <th scope="col" className="px-3 py-2.5 text-left font-semibold">Type</th>
                    <th scope="col" className="px-3 py-2.5 text-left font-semibold">Site</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Qty (L)</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Km</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Hours</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Consumption avg</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Standard</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Variance</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">Cost (GHS)</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold sm:px-6">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-slate-100 ${report.isFetching ? "opacity-60 transition-opacity" : ""}`}>
                  {rows.map((row) => {
                    const status = varianceStatusStyles[row.status];
                    const variance = row.varLHr ?? row.varLKm;
                    const perHour = row.basis === "hours";
                    return (
                      <SelectableRow key={row.equipmentId} id={row.equipmentId} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-5 py-3.5 sm:px-6">
                          <RowCheckbox id={row.equipmentId} label={row.equipmentCode} />
                        </td>
                        <td className="px-3 py-3.5 font-mono text-sm font-semibold text-slate-900">{row.equipmentCode}</td>
                        <td className="px-3 py-3.5 text-slate-700">{row.type}</td>
                        <td className="px-3 py-3.5 text-slate-500">{row.site}</td>
                        <td className="px-3 py-3.5 text-right tabular-nums text-slate-900">{row.qtyL.toLocaleString()}</td>
                        <td className="px-3 py-3.5 text-right tabular-nums text-slate-500">{row.km?.toLocaleString() ?? "—"}</td>
                        <td className="px-3 py-3.5 text-right tabular-nums text-slate-500">{row.hours?.toLocaleString() ?? "—"}</td>
                        <td className="px-3 py-3.5 text-right tabular-nums text-slate-700">
                          {dash(perHour ? row.lHrAvg : row.lKmAvg, perHour ? 2 : 3)}
                          <span className="ml-1 text-xs font-normal text-slate-400">{perHour ? "L/hr" : "L/km"}</span>
                        </td>
                        <td className="px-3 py-3.5 text-right tabular-nums text-slate-500">
                          {dash(perHour ? row.lHrStd : row.lKmStd, perHour ? 2 : 3)}
                          <span className="ml-1 text-xs font-normal text-slate-400">{perHour ? "L/hr" : "L/km"}</span>
                        </td>
                        <td className={`px-3 py-3.5 text-right font-medium tabular-nums ${varianceToneClass(variance)}`}>
                          {formatVariance(variance)}
                        </td>
                        <td className="px-3 py-3.5 text-right tabular-nums text-slate-900">{row.costGhs.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-right sm:px-6">
                          <StatusPill {...status} />
                        </td>
                      </SelectableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DataCard>
        </SelectionProvider>
      </div>

      <ConfirmDialog
        open={dialog !== null}
        onClose={closeDialog}
        onConfirm={() =>
          periodMutation.mutate(
            { id: periodId },
            {
              onSuccess: (result) => {
                toast.success(closed ? `${period?.label} reopened` : `${period?.label} closed`, { description: result.message });
                setDialog(null);
              },
            }
          )
        }
        title={closed ? `Reopen ${period?.label}?` : `Close ${period?.label}?`}
        confirmLabel={closed ? "Reopen month" : "Close month"}
        pendingLabel={closed ? "Reopening…" : "Closing…"}
        pending={periodMutation.isPending}
      >
        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          {closed
            ? "Fuel entries and deliveries dated in this month can be recorded again. Next month's opening balances stay as they are until you close this month again."
            : "Every tanker needs a closing dip first. Closing freezes each tanker's measured level as this month's closing balance and next month's opening balance, and blocks new entries dated in this month."}
        </p>
      </ConfirmDialog>
    </>
  );
}
