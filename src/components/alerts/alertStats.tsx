"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Eye, ShieldAlert, TriangleAlert } from "lucide-react";

import ErrorState from "@/components/ui/errorState";
import { StatTilesSkeleton } from "@/components/ui/skeleton";
import StatTile from "@/components/ui/statTile";
import { alertCountsQuery } from "@/queries/alertQueries";

const GRID = "mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4";

export default function AlertStats() {
  const query = useQuery(alertCountsQuery());

  if (query.isPending) return <StatTilesSkeleton count={4} className={GRID} />;
  if (query.isError) {
    return (
      <div className="mt-7 rounded-2xl border border-slate-200 bg-surface">
        <ErrorState size="sm" what="alert counts" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
      </div>
    );
  }

  const counts = query.data;
  return (
    <dl className={GRID}>
      <StatTile label="Critical" value={counts.critical.toLocaleString()} hint="Immediate review" icon={ShieldAlert} accent="text-brand-600" />
      <StatTile label="High" value={counts.high.toLocaleString()} hint="Above flag threshold" icon={TriangleAlert} accent="text-brand-500" />
      <StatTile label="Watch" value={counts.watch.toLocaleString()} hint="Monitoring" icon={Eye} />
      <StatTile label="Resolved" value={counts.resolvedThisMonth.toLocaleString()} hint="Closed this month" icon={CircleCheck} />
    </dl>
  );
}
