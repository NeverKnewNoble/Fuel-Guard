"use client";

import { useQuery } from "@tanstack/react-query";
import { Gauge, SlidersHorizontal } from "lucide-react";

import { EditThresholdsButton } from "@/components/modals/triggers";
import DataCard from "@/components/ui/dataCard";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { DataCardBodySkeleton } from "@/components/ui/skeleton";
import { thresholdsQuery } from "@/queries/standardsQueries";
import { thresholdStyles } from "@/utils/statusUtils";

export default function ThresholdsCard() {
  const query = useQuery(thresholdsQuery());
  const thresholds = query.data;
  const watch = thresholds?.find((t) => t.level === "watch");

  // `undefined` while loading or failed; `null` when loaded but not set up.
  const placeholder = query.isPending ? (
    <DataCardBodySkeleton body="tiles" label="Loading alert thresholds…" />
  ) : query.isError ? (
    <ErrorState what="alert thresholds" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
  ) : (
    thresholds === null && (
      <EmptyState
        icon={Gauge}
        title="Alert thresholds aren't set up"
        description="Until they are, fuel entries can't raise consumption alerts. Set the Watch, High and Critical levels to start."
      />
    )
  );

  return (
    <DataCard
      title="Alert thresholds"
      description="% variance above standard that triggers each severity level"
      action={query.isSuccess && <EditThresholdsButton thresholds={thresholds ?? null} />}
      emptyState={placeholder}
    >
      {thresholds && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {thresholds.map((threshold) => {
            const style = thresholdStyles[threshold.level];
            return (
              <div key={threshold.level} className={`rounded-xl border p-4 ${style.className}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {threshold.label}
                </p>
                <p className={`mt-2 text-3xl font-semibold ${style.valueClassName}`}>
                  +{threshold.percent}%
                </p>
              </div>
            );
          })}
        </div>
      )}
      {watch && (
        <p className="mt-4 flex items-start gap-2 text-sm text-slate-500">
          <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          Example: with Watch at {watch.percent}%, any unit consuming{" "}
          {watch.percent}% or more above its standard is listed on the
          watchlist automatically.
        </p>
      )}
    </DataCard>
  );
}
