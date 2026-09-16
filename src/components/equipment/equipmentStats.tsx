"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleSlash, Truck, Wrench } from "lucide-react";

import ErrorState from "@/components/ui/errorState";
import { StatTilesSkeleton } from "@/components/ui/skeleton";
import StatTile from "@/components/ui/statTile";
import { equipmentStatsQuery } from "@/queries/equipmentQueries";

const GRID = "mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3";

export default function EquipmentStats() {
  const query = useQuery(equipmentStatsQuery());

  if (query.isPending) return <StatTilesSkeleton count={3} className={GRID} />;
  if (query.isError) {
    return (
      <div className="mt-7 rounded-2xl border border-slate-200 bg-white">
        <ErrorState size="sm" what="equipment counts" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
      </div>
    );
  }

  const stats = query.data;
  return (
    <dl className={GRID}>
      <StatTile label="Active" value={stats.active.toLocaleString()} hint="In service" icon={Truck} />
      <StatTile label="Maintenance" value={stats.maintenance.toLocaleString()} hint="Off the roster" icon={Wrench} accent="text-brand-500" />
      <StatTile
        label="Idle"
        value={stats.idle.toLocaleString()}
        hint={stats.retired > 0 ? `Available · ${stats.retired} retired` : "Available, not assigned"}
        icon={CircleSlash}
      />
    </dl>
  );
}
