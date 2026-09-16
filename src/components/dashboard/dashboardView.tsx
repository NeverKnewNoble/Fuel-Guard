"use client";

import { useQuery } from "@tanstack/react-query";
import { Banknote, ClipboardList, Droplets, ShieldCheck, TriangleAlert, Truck } from "lucide-react";
import Link from "next/link";

import AnimatedStatTile from "@/components/ui/animatedStatTile";
import { ConsumptionChart, DailyIssuanceChart } from "@/components/ui/charts";
import DataCard from "@/components/ui/dataCard";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { DataCardBodySkeleton, StatTilesSkeleton } from "@/components/ui/skeleton";
import StatusPill from "@/components/ui/statusPill";
import { dashboardOverviewQuery } from "@/queries/dashboardQueries";
import { formatShortDateTime } from "@/utils/formatDate";
import { statusStyles } from "@/utils/fuelEntryUtils";
import { alertSeverityStyles } from "@/utils/statusUtils";

const TILE_GRID = "mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4";

export default function DashboardView() {
  const query = useQuery(dashboardOverviewQuery());
  const data = query.data;

  /** Every card shares one query, so they share its loading and error states. */
  const placeholder = (rows: number) =>
    query.isPending ? (
      <DataCardBodySkeleton body="list" rows={rows} label="Loading dashboard…" />
    ) : query.isError ? (
      <ErrorState
        size="sm"
        what="the dashboard"
        message={query.error.message}
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    ) : null;

  const kpis = data?.kpis;

  return (
    <>
      {query.isPending ? (
        <StatTilesSkeleton count={4} className={TILE_GRID} />
      ) : (
        <dl className={TILE_GRID}>
          <AnimatedStatTile
            label="Total fuel issued"
            value={kpis?.totalLitres ?? 0}
            suffix=" L"
            hint="This month"
            icon={<Droplets className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
            delay={0}
          />
          <AnimatedStatTile
            label="Fuel cost"
            value={kpis?.fuelCostGhs ?? 0}
            prefix="GHS "
            hint={kpis?.avgCostPerLitre ? `@ GHS ${kpis.avgCostPerLitre.toFixed(2)}/L` : "No fuel issued yet"}
            icon={<Banknote className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
            delay={70}
          />
          <AnimatedStatTile
            label="Active equipment"
            value={kpis?.activeEquipment ?? 0}
            hint={`${kpis?.idleOrMaintenance ?? 0} idle / maintenance`}
            icon={<Truck className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
            delay={140}
          />
          <AnimatedStatTile
            label="Flagged anomalies"
            value={kpis?.openAlerts ?? 0}
            hint="Requires review"
            icon={<TriangleAlert className="h-4 w-4 shrink-0 text-brand-500" aria-hidden />}
            delay={210}
          />
        </dl>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DataCard title="Daily fuel issuance" description="Last 11 days — litres issued" emptyState={placeholder(4)}>
          {data && <DailyIssuanceChart data={data.dailyIssuance} />}
        </DataCard>
        <DataCard title="Consumption vs standard" description="Litres per hour, actual against standard" emptyState={placeholder(4)}>
          {data && <ConsumptionChart data={data.consumption} />}
        </DataCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DataCard
          title="Anomaly watchlist"
          description="Units drawing more than their standard"
          flush
          action={
            <Link href="/portal/theft_alerts" className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-500">
              View all →
            </Link>
          }
          emptyState={
            placeholder(5) ??
            (data!.watchlist.length === 0 && (
              <EmptyState
                size="sm"
                icon={ShieldCheck}
                title="No units on the watchlist"
                description="Every unit is within its consumption standard."
              />
            ))
          }
        >
          <ul className="divide-y divide-slate-100">
            {data?.watchlist.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70 sm:px-6"
              >
                <div className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:gap-3">
                  <span className="order-2 whitespace-nowrap font-mono text-xs text-slate-500 sm:order-none">{item.equipmentCode}</span>
                  <span className="truncate text-sm font-medium text-slate-900">{item.equipmentName}</span>
                </div>
                <StatusPill {...alertSeverityStyles[item.severity]} />
              </li>
            ))}
          </ul>
        </DataCard>

        <DataCard
          title="Recent fuel log entries"
          description="Latest fills recorded across all sites"
          flush
          action={
            <Link href="/portal/fuel_entry" className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-500">
              View log →
            </Link>
          }
          emptyState={
            placeholder(5) ??
            (data!.recentEntries.length === 0 && (
              <EmptyState
                size="sm"
                icon={ClipboardList}
                title="No fuel entries yet"
                description="Entries recorded at the pump show up here."
              />
            ))
          }
        >
          <ul className="divide-y divide-slate-100">
            {data?.recentEntries.map((entry) => {
              const status = statusStyles[entry.status];
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70 sm:px-6"
                >
                  <div className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:gap-3">
                    <span className="order-2 whitespace-nowrap font-mono text-xs text-slate-500 sm:order-none">{entry.code}</span>
                    <span className="truncate text-sm font-medium text-slate-900">{entry.recordedBy}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden font-mono text-xs tabular-nums text-slate-400 sm:block">
                      {formatShortDateTime(entry.dispensedAt)}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-900">{entry.litres.toLocaleString()} L</span>
                    <StatusPill label={status.shortLabel} icon={status.icon} className={status.className} />
                  </div>
                </li>
              );
            })}
          </ul>
        </DataCard>
      </div>

      {query.isSuccess && (
        <p className="mt-4 text-xs text-slate-400">
          {kpis!.registeredUnits} registered units — active counts exclude plant in maintenance or sitting idle.
        </p>
      )}
    </>
  );
}
