"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Banknote, Download, Droplets, FileSpreadsheet, Lock, LockOpen, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/modals/confirmDialog";
import DataCard from "@/components/ui/dataCard";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import {
  DetailGroup,
  DetailItem,
  DetailPanel,
  ExpandButton,
  useDisclosure,
} from "@/components/ui/detailDisclosure";
import { MobileList, MobileRecordHeader } from "@/components/ui/mobileList";
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
import type { MonthlyEquipmentRow } from "@/types/monthly";
import { dash, formatVariance, varianceStatusStyles, varianceToneClass } from "@/utils/statusUtils";

const TILE_GRID = "mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3";

/** Everything the row doesn't show: usage on the unit's own basis, its standard, and what it cost. */
function SummaryDetails({ row, id, flush = false }: { row: MonthlyEquipmentRow; id: string; flush?: boolean }) {
  const perHour = row.basis === "hours";
  const unit = perHour ? "L/hr" : "L/km";
  const dp = perHour ? 2 : 3;
  return (
    <DetailPanel id={id} flush={flush}>
      <DetailGroup title="Usage">
        <DetailItem label={perHour ? "Total hours" : "Total km"} emphasis>
          {(perHour ? row.hours : row.km)?.toLocaleString() ?? "—"}
        </DetailItem>
        <DetailItem label="Quantity issued">{row.qtyL.toLocaleString()} L</DetailItem>
        <DetailItem label="Equipment type">{row.type}</DetailItem>
      </DetailGroup>

      <DetailGroup title="Against standard">
        <DetailItem label={`Average (${unit})`}>{dash(perHour ? row.lHrAvg : row.lKmAvg, dp)}</DetailItem>
        <DetailItem label={`Standard (${unit})`}>{dash(perHour ? row.lHrStd : row.lKmStd, dp)}</DetailItem>
        <DetailItem label="Variance" emphasis>
          <span className={varianceToneClass(row.varLHr ?? row.varLKm)}>{formatVariance(row.varLHr ?? row.varLKm)}</span>
        </DetailItem>
      </DetailGroup>

      <DetailGroup title="Cost">
        <DetailItem label="Fuel cost (GHS)" emphasis>
          {row.costGhs.toLocaleString()}
        </DetailItem>
        <DetailItem label="Site">{row.site}</DetailItem>
      </DetailGroup>
    </DetailPanel>
  );
}

function SummaryRow({ row }: { row: MonthlyEquipmentRow }) {
  const details = useDisclosure();
  const perHour = row.basis === "hours";
  const variance = row.varLHr ?? row.varLKm;
  return (
    <>
      <SelectableRow id={row.equipmentId} className="transition-colors hover:bg-slate-50/70">
        <td className="px-5 py-4 sm:px-6">
          <RowCheckbox id={row.equipmentId} label={row.equipmentCode} />
        </td>
        <td className="px-3 py-4">
          <span className="block font-medium text-slate-900">{row.equipmentCode}</span>
          <span className="block text-sm text-slate-500">{row.type}</span>
        </td>
        <td className="px-3 py-4 text-slate-500">{row.site}</td>
        <td className="px-3 py-4 text-right font-semibold tabular-nums text-slate-900">{row.qtyL.toLocaleString()}</td>
        <td className="px-3 py-4 text-right">
          <span className="tabular-nums text-slate-700">{dash(perHour ? row.lHrAvg : row.lKmAvg, perHour ? 2 : 3)}</span>
          <span className="ml-1 text-slate-400">{perHour ? "L/hr" : "L/km"}</span>
        </td>
        <td className={`px-3 py-4 text-right font-medium tabular-nums ${varianceToneClass(variance)}`}>
          {formatVariance(variance)}
        </td>
        <td className="px-3 py-4 text-right">
          <StatusPill {...varianceStatusStyles[row.status]} />
        </td>
        <td className="px-5 py-4 text-right sm:px-6">
          <ExpandButton {...details.buttonProps} label={`details for ${row.equipmentCode}`} />
        </td>
      </SelectableRow>
      {details.open && (
        <tr>
          <td colSpan={8} className="p-0">
            <SummaryDetails row={row} id={details.panelId} flush />
          </td>
        </tr>
      )}
    </>
  );
}

function SummaryCard({ row }: { row: MonthlyEquipmentRow }) {
  const details = useDisclosure();
  const perHour = row.basis === "hours";
  const variance = row.varLHr ?? row.varLKm;
  return (
    <SelectableRow id={row.equipmentId} as="li">
      <div className="px-5 py-4 sm:px-6">
        <MobileRecordHeader
          select={<RowCheckbox id={row.equipmentId} label={row.equipmentCode} />}
          title={row.equipmentCode}
          subtitle={`${row.type} · ${row.site}`}
          trailing={<StatusPill {...varianceStatusStyles[row.status]} />}
        />
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl font-semibold tabular-nums text-slate-900">{row.qtyL.toLocaleString()}</span>
          <span className="text-slate-400">L</span>
          <span className={`ml-auto font-medium tabular-nums ${varianceToneClass(variance)}`}>{formatVariance(variance)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-500">
            {dash(perHour ? row.lHrAvg : row.lKmAvg, perHour ? 2 : 3)}{" "}
            <span className="text-slate-400">{perHour ? "L/hr" : "L/km"}</span>
          </span>
          <ExpandButton {...details.buttonProps} label={`details for ${row.equipmentCode}`} variant="text" />
        </div>
      </div>
      {details.open && <SummaryDetails row={row} id={details.panelId} />}
    </SelectableRow>
  );
}

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
        // description="All sites · all equipment, measured against consumption standards."
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
              {rows.map((row) => (
                <SummaryCard key={row.equipmentId} row={row} />
              ))}
            </MobileList>
            <div className="hidden lg:block">
              <table className="w-full border-collapse text-[15px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wider text-slate-400">
                    <th scope="col" className="w-10 px-5 py-3 text-left sm:px-6">
                      <SelectAllCheckbox label="rows" />
                    </th>
                    <th scope="col" className="px-3 py-3 text-left font-semibold">Equipment</th>
                    <th scope="col" className="px-3 py-3 text-left font-semibold">Site</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">Qty (L)</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">Consumption</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">Variance</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">Status</th>
                    <th scope="col" className="w-14 px-5 py-3 text-right font-semibold sm:px-6">
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-slate-100 ${report.isFetching ? "opacity-60 transition-opacity" : ""}`}>
                  {rows.map((row) => (
                    <SummaryRow key={row.equipmentId} row={row} />
                  ))}
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
