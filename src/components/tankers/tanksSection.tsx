"use client";

import { useQuery } from "@tanstack/react-query";

import { AddTankerButton } from "@/components/modals/triggers";
import ErrorState from "@/components/ui/errorState";
import { TankCardsSkeleton } from "@/components/ui/skeleton";
import TankScroller from "@/components/ui/tankScroller";
import { tanksQuery } from "@/queries/tankQueries";

/** The "Fuel tankers" row of level cards. */
export default function TanksSection() {
  const query = useQuery(tanksQuery());

  if (query.isPending) {
    return (
      <div role="status">
        <span className="sr-only">Loading tankers…</span>
        <TankCardsSkeleton count={4} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <section>
        <h2 className="text-base font-semibold text-slate-900">Fuel tankers</h2>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white">
          <ErrorState size="sm" what="tankers" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
        </div>
      </section>
    );
  }

  return <TankScroller tanks={query.data} emptyAction={<AddTankerButton />} />;
}
