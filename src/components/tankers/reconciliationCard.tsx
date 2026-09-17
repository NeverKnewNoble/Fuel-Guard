"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Lock, Scale, TriangleAlert } from "lucide-react";

import { TankRowActions } from "@/components/tankers/tankRowActions";
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
import {
  RowCheckbox,
  SelectAllBar,
  SelectAllCheckbox,
  SelectableRow,
  SelectionBar,
  SelectionProvider,
} from "@/components/ui/selection";
import { DataCardBodySkeleton } from "@/components/ui/skeleton";
import { reconciliationQuery } from "@/queries/tankQueries";
import type { ReconciliationRow } from "@/types/tank";
import { varianceTone } from "@/utils/tankUtils";

const litres = (n: number) => n.toLocaleString();

/** Measured level, or a prompt when the tanker hasn't been dipped this period. */
function Measured({ row }: { row: ReconciliationRow }) {
  if (row.measuredL === null) return <span className="font-medium text-amber-700">No dip</span>;
  return <span className="font-medium tabular-nums text-slate-900">{litres(row.measuredL)}</span>;
}

function Variance({ row }: { row: ReconciliationRow }) {
  if (row.varianceL === null) return <span className="text-slate-400">—</span>;
  const v = row.varianceL;
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${varianceTone(v)}`}>
      {v < 0 ? <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      {v === 0 ? "0 L" : `${v > 0 ? "+" : ""}${litres(v)} L`}
    </span>
  );
}

/** The arithmetic behind the expected figure, spelled out: opening + intake − issued. */
function ReconciliationDetails({ row, id, flush = false }: { row: ReconciliationRow; id: string; flush?: boolean }) {
  return (
    <DetailPanel id={id} flush={flush}>
      <DetailGroup title="Movement this period">
        <DetailItem label="Opening balance">{litres(row.openingL)} L</DetailItem>
        <DetailItem label="Received (intake)">{row.intakeL ? `+${litres(row.intakeL)} L` : "—"}</DetailItem>
        <DetailItem label="Issued to equipment">{row.issuedL ? `−${litres(row.issuedL)} L` : "—"}</DetailItem>
        <DetailItem label="Expected balance" emphasis>
          {litres(row.expectedL)} L
        </DetailItem>
      </DetailGroup>

      <DetailGroup title="Against the dip">
        <DetailItem label="Measured (last dip)">
          <Measured row={row} />
        </DetailItem>
        <DetailItem label="Variance" emphasis>
          <Variance row={row} />
        </DetailItem>
      </DetailGroup>

      <DetailGroup title="Tanker">
        <DetailItem label="Code">{row.tankCode}</DetailItem>
        <DetailItem label="Name">{row.name}</DetailItem>
      </DetailGroup>
    </DetailPanel>
  );
}

function ReconciliationTableRow({ row }: { row: ReconciliationRow }) {
  const details = useDisclosure();
  const actions = { id: row.tankId, code: row.tankCode, name: row.name, currentL: row.measuredL };
  return (
    <>
      <SelectableRow id={row.tankId} className="transition-colors hover:bg-slate-50/70">
        <td className="px-5 py-4 sm:px-6">
          <RowCheckbox id={row.tankId} label={row.name} />
        </td>
        <td className="px-3 py-4">
          <span className="block font-medium text-slate-900">{row.name}</span>
          <span className="block text-sm text-slate-500">{row.tankCode}</span>
        </td>
        <td className="px-3 py-4 text-right tabular-nums text-slate-500">{litres(row.expectedL)}</td>
        <td className="px-3 py-4 text-right">
          <Measured row={row} />
        </td>
        <td className="px-3 py-4 text-right">
          <Variance row={row} />
        </td>
        <td className="px-5 py-4 sm:px-6">
          <div className="flex items-center justify-end gap-1">
            <ExpandButton {...details.buttonProps} label={`the movement behind ${row.name}`} />
            <TankRowActions tank={actions} canEdit={false} />
          </div>
        </td>
      </SelectableRow>
      {details.open && (
        <tr>
          <td colSpan={6} className="p-0">
            <ReconciliationDetails row={row} id={details.panelId} flush />
          </td>
        </tr>
      )}
    </>
  );
}

function ReconciliationCardRow({ row }: { row: ReconciliationRow }) {
  const details = useDisclosure();
  const actions = { id: row.tankId, code: row.tankCode, name: row.name, currentL: row.measuredL };
  return (
    <SelectableRow id={row.tankId} as="li">
      <div className="px-5 py-4 sm:px-6">
        <MobileRecordHeader
          select={<RowCheckbox id={row.tankId} label={row.name} />}
          title={row.name}
          subtitle={row.tankCode}
          trailing={<TankRowActions tank={actions} canEdit={false} />}
        />
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <span className="text-sm text-slate-500">
            Expected <span className="ml-1 font-medium tabular-nums text-slate-900">{litres(row.expectedL)} L</span>
          </span>
          <Variance row={row} />
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-500">
            Measured <span className="ml-1"><Measured row={row} /></span>
          </span>
          <ExpandButton {...details.buttonProps} label={`the movement behind ${row.name}`} variant="text" />
        </div>
      </div>
      {details.open && <ReconciliationDetails row={row} id={details.panelId} />}
    </SelectableRow>
  );
}

export default function ReconciliationCard() {
  const query = useQuery(reconciliationQuery());
  const report = query.data;
  const rows = report?.rows ?? [];

  const placeholder = query.isPending ? (
    <DataCardBodySkeleton rows={4} columns={8} label="Loading stock reconciliation…" />
  ) : query.isError ? (
    <ErrorState what="the stock reconciliation" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
  ) : (
    rows.length === 0 && (
      <EmptyState
        icon={Scale}
        title="Nothing to reconcile yet"
        description="Add a tanker with its opening level. Its expected and measured stock will be compared here."
      />
    )
  );

  return (
    <SelectionProvider ids={rows.map((r) => r.tankId)}>
    <DataCard
      title={report ? `Stock reconciliation — ${report.period.label}` : "Stock reconciliation"}
      description="Opening + intake − issued = expected. The gap against the measured dip is unexplained loss."
      flush
      action={
        query.isSuccess && (
          <div className="flex flex-wrap items-center gap-2">
            <SelectionBar noun="tanker" actions={["export"]} />
            {report!.period.status === "closed" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                <Lock className="h-3 w-3" aria-hidden />
                Month closed
              </span>
            )}
            {rows.length > 0 &&
              (report!.lossL > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                  <TriangleAlert className="h-3 w-3" aria-hidden />
                  {litres(report!.lossL)} L unexplained loss
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <CircleCheck className="h-3 w-3" aria-hidden />
                  No loss
                </span>
              ))}
          </div>
        )
      }
      emptyState={placeholder}
    >
      <SelectAllBar label="tankers" />
      <MobileList>
        {rows.map((row) => (
          <ReconciliationCardRow key={row.tankId} row={row} />
        ))}
      </MobileList>
      <div className="hidden lg:block">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wider text-slate-400">
              <th scope="col" className="w-10 px-5 py-3 text-left sm:px-6">
                <SelectAllCheckbox label="tankers" />
              </th>
              <th scope="col" className="px-3 py-3 text-left font-semibold">Tanker</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Expected</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Measured</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Variance</th>
              <th scope="col" className="w-24 px-5 py-3 text-right font-semibold sm:px-6">
                <span className="sr-only">Details and actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <ReconciliationTableRow key={row.tankId} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </DataCard>
    </SelectionProvider>
  );
}
