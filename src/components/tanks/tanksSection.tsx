"use client";

import { useQuery } from "@tanstack/react-query";

import { AddTankButton } from "@/components/modals/triggers";
import ErrorState from "@/components/ui/errorState";
import { TankCardsSkeleton } from "@/components/ui/skeleton";
import TankScroller from "@/components/ui/tankScroller";
import { tanksQuery } from "@/queries/tankQueries";

/** The "Fuel tanks" row of level cards. */
export default function TanksSection() {
  const query = useQuery(tanksQuery());

  if (query.isPending) {
    return (
      <div role="status">
        <span className="sr-only">Loading tanks…</span>
        <TankCardsSkeleton count={4} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <section>
        <h2 className="text-base font-semibold text-slate-900">Fuel tanks</h2>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-surface">
          <ErrorState size="sm" what="tanks" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
        </div>
      </section>
    );
  }

  return <TankScroller tanks={query.data} emptyAction={<AddTankButton />} />;
}
