"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Users } from "lucide-react";

import ErrorState from "@/components/ui/errorState";
import { StatTilesSkeleton } from "@/components/ui/skeleton";
import StatTile from "@/components/ui/statTile";
import { accountStatsQuery } from "@/queries/userQueries";

const GRID = "mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3";

export default function AccountStats() {
  const query = useQuery(accountStatsQuery());

  if (query.isPending) return <StatTilesSkeleton count={3} className={GRID} />;
  if (query.isError) {
    return (
      <div className="mt-7 rounded-2xl border border-slate-200 bg-white">
        <ErrorState size="sm" what="account counts" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
      </div>
    );
  }

  const stats = query.data;
  return (
    <dl className={GRID}>
      <StatTile label="Administrators" value={stats.administrators.toLocaleString()} hint="Full portal access" icon={ShieldCheck} />
      <StatTile label="Records takers" value={stats.recordsTakers.toLocaleString()} hint="Entry capture only" icon={Users} />
      <StatTile label="Active accounts" value={stats.active.toLocaleString()} hint={`of ${stats.total.toLocaleString()} total`} icon={Users} />
    </dl>
  );
}
