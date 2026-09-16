"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleSlash, HardHat, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/modals/confirmDialog";
import OperatorFormModal from "@/components/modals/operatorFormModal";
import { AddOperatorButton } from "@/components/setup/setupTriggers";
import DataCard from "@/components/ui/dataCard";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { MobileField, MobileFields, MobileList, MobileRecordHeader } from "@/components/ui/mobileList";
import RowActions from "@/components/ui/rowActions";
import { DataCardBodySkeleton } from "@/components/ui/skeleton";
import { useSetOperatorActive } from "@/queries/setupMutations";
import { allOperatorsQuery } from "@/queries/setupQueries";
import type { OperatorRow } from "@/types/operator";
import { initialsOf } from "@/utils/fuelEntryUtils";

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
        isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      {isActive ? <CircleCheck className="h-3 w-3 shrink-0" aria-hidden /> : <CircleSlash className="h-3 w-3 shrink-0" aria-hidden />}
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function OperatorRowActions({ operator }: { operator: OperatorRow }) {
  const [dialog, setDialog] = useState<"edit" | "deactivate" | null>(null);
  const setActive = useSetOperatorActive();
  const close = () => {
    setDialog(null);
    setActive.reset();
  };

  return (
    <>
      <RowActions
        label={operator.name}
        items={[
          { label: "Edit", icon: Pencil, onSelect: () => setDialog("edit") },
          {
            label: "Deactivate",
            icon: CircleSlash,
            onSelect: () => setDialog("deactivate"),
            hidden: !operator.isActive,
            tone: "danger",
            separated: true,
          },
          {
            label: "Reactivate",
            icon: CircleCheck,
            hidden: operator.isActive,
            separated: true,
            onSelect: () =>
              setActive.mutate(
                { id: operator.id, isActive: true },
                { onSuccess: (result) => toast.success(`${operator.name} reactivated`, { description: result.message }) }
              ),
          },
        ]}
      />
      <OperatorFormModal open={dialog === "edit"} onClose={close} operator={operator} />
      <ConfirmDialog
        open={dialog === "deactivate"}
        onClose={close}
        onConfirm={() =>
          setActive.mutate(
            { id: operator.id, isActive: false },
            {
              onSuccess: (result) => {
                toast.success(`${operator.name} deactivated`, { description: result.message });
                setDialog(null);
              },
            }
          )
        }
        title={`Deactivate ${operator.name}?`}
        description={operator.siteName ?? "All sites"}
        confirmLabel="Deactivate"
        pendingLabel="Deactivating…"
        pending={setActive.isPending}
      >
        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          They stop appearing when recording a fill. Their past fuel entries keep their name, which is why operators are never deleted.
        </p>
      </ConfirmDialog>
    </>
  );
}

export default function OperatorsCard() {
  const query = useQuery(allOperatorsQuery());
  const operators = query.data ?? [];

  const placeholder = query.isPending ? (
    <DataCardBodySkeleton rows={5} columns={5} label="Loading operators…" />
  ) : query.isError ? (
    <ErrorState what="operators" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
  ) : (
    operators.length === 0 && (
      <EmptyState
        icon={HardHat}
        title="No operators yet"
        description="Add the drivers and plant operators who draw fuel. Every fuel entry is recorded against one of them."
        action={<AddOperatorButton />}
      />
    )
  );

  return (
    <DataCard
      title="Drivers & operators"
      description="Who a fill is recorded against. They only need a portal account if they record entries themselves."
      flush
      emptyState={placeholder}
    >
      <MobileList>
        {operators.map((operator) => (
          <li key={operator.id} className={`px-5 py-4 sm:px-6 ${operator.isActive ? "" : "opacity-70"}`}>
            <MobileRecordHeader
              title={operator.name}
              subtitle={operator.phone ?? "No phone"}
              trailing={
                <>
                  <StatusBadge isActive={operator.isActive} />
                  <OperatorRowActions operator={operator} />
                </>
              }
            />
            <MobileFields>
              <MobileField label="Site">{operator.siteName ?? "All sites"}</MobileField>
              <MobileField label="Portal account">{operator.userName ?? "Not linked"}</MobileField>
            </MobileFields>
          </li>
        ))}
      </MobileList>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-150 border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-400">
              <th scope="col" className="px-5 py-2.5 text-left font-semibold sm:px-6">Operator</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Phone</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Site</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Portal account</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Status</th>
              <th scope="col" className="px-5 py-2.5 text-right font-semibold sm:px-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {operators.map((operator) => (
              <tr key={operator.id} className={`transition-colors hover:bg-slate-50/70 ${operator.isActive ? "" : "text-slate-400"}`}>
                <td className="px-5 py-3.5 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                      {initialsOf(operator.name)}
                    </span>
                    <span className="font-medium text-slate-900">{operator.name}</span>
                  </div>
                </td>
                <td className="px-3 py-3.5 font-mono text-xs tabular-nums text-slate-500">{operator.phone ?? "—"}</td>
                <td className="px-3 py-3.5 text-slate-500">{operator.siteName ?? "All sites"}</td>
                <td className="px-3 py-3.5 text-slate-500">{operator.userName ?? "Not linked"}</td>
                <td className="px-3 py-3.5 text-right">
                  <StatusBadge isActive={operator.isActive} />
                </td>
                <td className="px-5 py-3.5 text-right sm:px-6">
                  <OperatorRowActions operator={operator} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataCard>
  );
}
