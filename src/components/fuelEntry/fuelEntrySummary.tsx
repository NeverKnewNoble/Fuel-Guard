"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Droplets, Lock, TriangleAlert } from "lucide-react";

import ErrorState from "@/components/ui/errorState";
import { StatTilesSkeleton } from "@/components/ui/skeleton";
import StatTile from "@/components/ui/statTile";
import { fuelEntrySummaryQuery } from "@/queries/fuelEntryQueries";

const GRID = "mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4";

export default function FuelEntrySummary() {
  const query = useQuery(fuelEntrySummaryQuery());

  if (query.isPending) return <StatTilesSkeleton count={4} className={GRID} />;
  if (query.isError) {
    return (
      <div className="mt-7 rounded-2xl border border-slate-200 bg-white">
        <ErrorState size="sm" what="the entry summary" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
      </div>
    );
  }

  const summary = query.data;
  return (
    <dl className={GRID}>
      <StatTile label="Entries logged" value={summary.total.toLocaleString()} hint="Last 2 days" icon={ClipboardList} />
      <StatTile label="Litres recorded" value={summary.litres.toLocaleString()} hint="Last 2 days" icon={Droplets} />
      <StatTile
        label="Needs review"
        value={(summary.flagged + summary.watch).toLocaleString()}
        hint="Flagged or on watch"
        icon={TriangleAlert}
        accent="text-brand-500"
      />
      <StatTile label="Locked" value={summary.locked.toLocaleString()} hint="No action needed" icon={Lock} />
    </dl>
  );
}
