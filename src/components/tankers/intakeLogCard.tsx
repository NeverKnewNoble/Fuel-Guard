"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, Truck } from "lucide-react";

import { RecordIntakeButton } from "@/components/modals/triggers";
import { IntakeRowActions } from "@/components/tankers/intakeRowActions";
import DataCard from "@/components/ui/dataCard";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { MobileField, MobileFields, MobileList, MobileRecordHeader } from "@/components/ui/mobileList";
import {
  RowCheckbox,
  SelectAllBar,
  SelectAllCheckbox,
  SelectableRow,
  SelectionBar,
  SelectionProvider,
} from "@/components/ui/selection";
import { DataCardBodySkeleton } from "@/components/ui/skeleton";
import { intakesQuery, tanksQuery } from "@/queries/tankQueries";
import { formatDateTime } from "@/utils/formatDate";

function VoidPill() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
      <Ban className="h-3 w-3 shrink-0" aria-hidden />
      Void
    </span>
  );
}

const ghs = (n: number) => `GHS ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A delivery recorded in error is voided, not deleted: it stays in the log but drops out of stock, costs and the reconciliation. */
export default function IntakeLogCard({ currentUserId }: { currentUserId: string }) {
  const query = useQuery(intakesQuery());
  const tanks = useQuery(tanksQuery());
  const intakes = query.data ?? [];

  const placeholder = query.isPending ? (
    <DataCardBodySkeleton rows={5} columns={7} label="Loading intake log…" />
  ) : query.isError ? (
    <ErrorState what="the intake log" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
  ) : (
    intakes.length === 0 && (
      <EmptyState
        icon={Truck}
        title="No deliveries recorded"
        description="Record each delivery taken into a tanker, with its supplier and delivery note."
        action={(tanks.data?.length ?? 0) > 0 && <RecordIntakeButton currentUserId={currentUserId} />}
      />
    )
  );

  return (
    <SelectionProvider ids={intakes.map((i) => i.id)}>
    <DataCard
      title="Intake log"
      description="The 50 most recent deliveries received into a tanker, with supplier and delivery note."
      flush
      action={query.isSuccess && <SelectionBar noun="intake" actions={["export"]} />}
      emptyState={placeholder}
    >
      <SelectAllBar label="intakes" />
      <MobileList>
        {intakes.map((intake) => (
          <SelectableRow key={intake.id} id={intake.id} as="li" className={`px-5 py-4 sm:px-6 ${intake.voidedAt ? "opacity-70" : ""}`}>
            <MobileRecordHeader
              select={<RowCheckbox id={intake.id} label={intake.code} />}
              title={
                <>
                  <span className={`font-mono ${intake.voidedAt ? "line-through" : ""}`}>{intake.code}</span> · {intake.tankName}
                </>
              }
              subtitle={intake.voidedAt ? `Void — ${intake.voidReason ?? "no reason given"}` : intake.supplier}
              trailing={
                <>
                  {intake.voidedAt && <VoidPill />}
                  <IntakeRowActions intake={intake} />
                </>
              }
            />
            <MobileFields>
              <MobileField label="Litres"><span className="font-medium tabular-nums text-slate-900">{intake.litres.toLocaleString()} L</span></MobileField>
              <MobileField label="Cost"><span className="tabular-nums">{ghs(intake.totalCost)}</span></MobileField>
              <MobileField label="Delivery note"><span className="font-mono text-xs">{intake.deliveryNote}</span></MobileField>
              <MobileField label="Received">
                <span className="block font-mono text-xs tabular-nums">{formatDateTime(intake.receivedAt)}</span>
                <span className="block truncate text-xs text-slate-400">{intake.receivedBy}</span>
              </MobileField>
            </MobileFields>
          </SelectableRow>
        ))}
      </MobileList>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-400">
              <th scope="col" className="w-10 px-5 py-2.5 text-left sm:px-6">
                <SelectAllCheckbox label="intakes" />
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Intake</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Tanker</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Supplier</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Delivery note</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Litres</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Cost</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Received</th>
              <th scope="col" className="px-5 py-2.5 text-right font-semibold sm:px-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {intakes.map((intake) => (
              <SelectableRow
                key={intake.id}
                id={intake.id}
                className={`transition-colors hover:bg-slate-50/70 ${intake.voidedAt ? "text-slate-400" : ""}`}
              >
                <td className="px-5 py-3.5 sm:px-6">
                  <RowCheckbox id={intake.id} label={intake.code} />
                </td>
                <td className="px-3 py-3.5 font-mono text-sm font-semibold text-slate-900">
                  <span className={intake.voidedAt ? "line-through" : ""}>{intake.code}</span>
                  {intake.voidedAt && (
                    <span className="ml-2 align-middle">
                      <VoidPill />
                    </span>
                  )}
                </td>
                <td className="px-3 py-3.5 text-slate-700">{intake.tankName}</td>
                <td className="px-3 py-3.5 text-slate-500">{intake.supplier}</td>
                <td className="px-3 py-3.5 font-mono text-xs text-slate-500">{intake.deliveryNote}</td>
                <td className="px-3 py-3.5 text-right font-medium tabular-nums text-slate-900">{intake.litres.toLocaleString()} L</td>
                <td className="px-3 py-3.5 text-right tabular-nums text-slate-700">
                  {ghs(intake.totalCost)}
                  <span className="block text-xs text-slate-400">@ {intake.costPerLitre.toFixed(3)}/L</span>
                </td>
                <td className="px-3 py-3.5 text-right">
                  <span className="block font-mono text-xs tabular-nums text-slate-500">{formatDateTime(intake.receivedAt)}</span>
                  <span className="block text-xs text-slate-400">{intake.receivedBy}</span>
                </td>
                <td className="px-5 py-3.5 text-right sm:px-6">
                  <IntakeRowActions intake={intake} />
                </td>
              </SelectableRow>
            ))}
          </tbody>
        </table>
      </div>
    </DataCard>
    </SelectionProvider>
  );
}
