"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, FilePenLine, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import RejectCorrectionModal from "@/components/modals/rejectCorrectionModal";
import DataCard from "@/components/ui/dataCard";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { DataCardBodySkeleton } from "@/components/ui/skeleton";
import { useApproveCorrection } from "@/queries/fuelEntryMutations";
import { pendingCorrectionsQuery } from "@/queries/fuelEntryQueries";
import type { PendingCorrectionRow } from "@/types/fuelLog";
import { formatDateTime } from "@/utils/formatDate";

/** Administrators only: correction requests waiting for a decision, oldest first. */
export default function PendingCorrectionsCard() {
  const query = useQuery(pendingCorrectionsQuery());
  const [rejecting, setRejecting] = useState<PendingCorrectionRow | null>(null);
  const approve = useApproveCorrection();
  const rows = query.data ?? [];

  const placeholder = query.isPending ? (
    <DataCardBodySkeleton body="list" rows={2} label="Loading correction requests…" />
  ) : query.isError ? (
    <ErrorState what="correction requests" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
  ) : (
    rows.length === 0 && (
      <EmptyState
        size="sm"
        icon={FilePenLine}
        title="No corrections waiting"
        description="Requests from records takers appear here for approval."
      />
    )
  );

  return (
    <>
      <DataCard
        title="Pending corrections"
        description="Approving rewrites the entry and re-checks it against its consumption standard."
        flush
        action={
          rows.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              {rows.length} waiting
            </span>
          )
        }
        emptyState={placeholder}
      >
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const pending = approve.isPending && approve.variables?.id === row.id;
            return (
              <li key={row.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-900">{row.entryCode}</span>
                  <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{row.equipmentCode}</span>
                  <span className="ml-auto font-mono text-xs tabular-nums text-slate-500">{formatDateTime(row.createdAt)}</span>
                </div>

                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">{row.requestedBy.name}</span>: {row.reason}
                </p>

                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {row.changes.map((change) => (
                    <li key={change.field} className="text-sm text-slate-700">
                      <span className="text-slate-500">{change.label}:</span> <span className="line-through text-slate-400">{change.from}</span>{" "}
                      <span className="font-medium tabular-nums">{change.to}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={approve.isPending}
                    onClick={() =>
                      approve.mutate(
                        { id: row.id },
                        { onSuccess: (result) => toast.success(`${row.entryCode} corrected`, { description: result.message }) }
                      )
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
                    {pending ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={approve.isPending}
                    onClick={() => setRejecting(row)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                    Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </DataCard>

      {rejecting && <RejectCorrectionModal open onClose={() => setRejecting(null)} correction={rejecting} />}
    </>
  );
}
