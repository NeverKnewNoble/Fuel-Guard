"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, ArrowRight, Ban } from "lucide-react";

import { TransferFuelButton } from "@/components/modals/triggers";
import { TransferRowActions } from "@/components/tanks/transferRowActions";
import DataCard from "@/components/ui/dataCard";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { MobileList, MobileRecordHeader } from "@/components/ui/mobileList";
import { DataCardBodySkeleton } from "@/components/ui/skeleton";
import { tanksQuery, transfersQuery } from "@/queries/tankQueries";
import type { TransferRow } from "@/types/tank";
import { formatDateTime } from "@/utils/formatDate";

function VoidPill() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
      <Ban className="h-3 w-3 shrink-0" aria-hidden />
      Void
    </span>
  );
}

function Route({ transfer }: { transfer: TransferRow }) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${transfer.voidedAt ? "line-through" : ""}`}>
      {transfer.fromTankName}
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="to" />
      {transfer.toTankName}
    </span>
  );
}

function subtitle(transfer: TransferRow) {
  if (transfer.voidedAt) return `Void — ${transfer.voidReason ?? "no reason given"}`;
  return [transfer.code, transfer.transferredBy, transfer.note].filter(Boolean).join(" · ");
}

function TransferTableRow({ transfer }: { transfer: TransferRow }) {
  return (
    <tr className={`transition-colors hover:bg-slate-50/70 ${transfer.voidedAt ? "opacity-70" : ""}`}>
      <td className="px-5 py-4 whitespace-nowrap tabular-nums text-slate-500 sm:px-6">{formatDateTime(transfer.transferredAt)}</td>
      <td className="px-3 py-4">
        <span className="block font-medium text-slate-900">
          <Route transfer={transfer} />
        </span>
        <span className="block text-sm text-slate-500">{subtitle(transfer)}</span>
      </td>
      <td className="px-3 py-4 text-right">
        <span className="font-semibold tabular-nums text-slate-900">{transfer.litres.toLocaleString()}</span>
        <span className="ml-1 text-slate-400">L</span>
      </td>
      <td className="px-3 py-4 text-right">{transfer.voidedAt && <VoidPill />}</td>
      <td className="px-5 py-4 text-right sm:px-6">
        <TransferRowActions transfer={transfer} />
      </td>
    </tr>
  );
}

function TransferCard({ transfer }: { transfer: TransferRow }) {
  return (
    <li className={transfer.voidedAt ? "opacity-70" : ""}>
      <div className="px-5 py-4 sm:px-6">
        <MobileRecordHeader
          title={<Route transfer={transfer} />}
          subtitle={subtitle(transfer)}
          trailing={
            <>
              {transfer.voidedAt && <VoidPill />}
              <TransferRowActions transfer={transfer} />
            </>
          }
        />
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl font-semibold tabular-nums text-slate-900">{transfer.litres.toLocaleString()}</span>
          <span className="text-slate-400">L</span>
          <span className="ml-auto text-sm tabular-nums text-slate-500">{formatDateTime(transfer.transferredAt)}</span>
        </div>
      </div>
    </li>
  );
}

/** Fuel moved between tanks. A transfer recorded in error is voided, not deleted. */
export default function TransferLogCard() {
  const query = useQuery(transfersQuery());
  const tanks = useQuery(tanksQuery());
  const transfers = query.data ?? [];

  const placeholder = query.isPending ? (
    <DataCardBodySkeleton rows={3} columns={5} label="Loading transfer log…" />
  ) : query.isError ? (
    <ErrorState what="the transfer log" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
  ) : (
    transfers.length === 0 && (
      <EmptyState
        icon={ArrowLeftRight}
        title="No transfers recorded"
        description="Record fuel moved from one tank into another, e.g. topping up a day tank from the bulk tank."
        action={(tanks.data?.length ?? 0) > 1 && <TransferFuelButton />}
      />
    )
  );

  return (
    <DataCard
      title="Transfer log"
      description="The 50 most recent transfers between tanks."
      flush
      emptyState={placeholder}
    >
      <MobileList>
        {transfers.map((transfer) => (
          <TransferCard key={transfer.id} transfer={transfer} />
        ))}
      </MobileList>
      <div className="hidden lg:block">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wider text-slate-400">
              <th scope="col" className="px-5 py-3 text-left font-semibold sm:px-6">Transferred</th>
              <th scope="col" className="px-3 py-3 text-left font-semibold">From → to</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Litres</th>
              <th scope="col" className="w-20 px-3 py-3 text-right font-semibold">
                <span className="sr-only">Void</span>
              </th>
              <th scope="col" className="w-16 px-5 py-3 text-right font-semibold sm:px-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transfers.map((transfer) => (
              <TransferTableRow key={transfer.id} transfer={transfer} />
            ))}
          </tbody>
        </table>
      </div>
    </DataCard>
  );
}
