"use client";

import { useQuery } from "@tanstack/react-query";
import { Ruler } from "lucide-react";

import { SecondaryButton } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { DataCardBodySkeleton } from "@/components/ui/skeleton";
import { tankDipsQuery } from "@/queries/tankQueries";
import { formatDateTime } from "@/utils/formatDate";

type Props = { open: boolean; onClose: () => void; tank: { id: string; code: string; name: string } };

export default function DipHistoryModal({ open, ...props }: Props) {
  if (!open) return null;
  return <DipHistory {...props} />;
}

function DipHistory({ onClose, tank }: Omit<Props, "open">) {
  const query = useQuery(tankDipsQuery(tank.id));

  return (
    <Modal
      open
      onClose={onClose}
      title={`Dip history — ${tank.name}`}
      description={`${tank.code}. The 30 most recent measurements, newest first.`}
      footer={
        <SecondaryButton type="button" onClick={onClose}>
          Close
        </SecondaryButton>
      }
    >
      <div className="-mx-5 pb-2 sm:-mx-6">
        {query.isPending ? (
          <DataCardBodySkeleton body="list" rows={5} label="Loading dips…" />
        ) : query.isError ? (
          <ErrorState size="sm" what="dips" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
        ) : query.data.length === 0 ? (
          <EmptyState size="sm" icon={Ruler} title="No dips recorded" description="Record a dip to set this tanker's level." />
        ) : (
          <ul className="divide-y divide-slate-100 border-y border-slate-100">
            {query.data.map((dip) => (
              <li key={dip.id} className="flex items-start justify-between gap-3 px-5 py-3 sm:px-6">
                <div className="min-w-0">
                  <p className="font-mono text-xs tabular-nums text-slate-500">{formatDateTime(dip.measuredAt)}</p>
                  <p className="mt-0.5 truncate text-sm text-slate-600">
                    {dip.recordedBy.name}
                    {dip.note && <span className="text-slate-400"> · {dip.note}</span>}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{dip.measuredL.toLocaleString()} L</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
