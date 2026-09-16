"use client";

import { useQuery } from "@tanstack/react-query";
import { Construction } from "lucide-react";

import { AddEquipmentTypeButton } from "@/components/modals/triggers";
import { StandardRowActions, StandardsSelectionBar } from "@/components/standards/standardActions";
import DataCard from "@/components/ui/dataCard";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { MobileField, MobileFields, MobileList, MobileRecordHeader } from "@/components/ui/mobileList";
import {
  RowCheckbox,
  SelectAllBar,
  SelectAllCheckbox,
  SelectableRow,
  SelectionProvider,
} from "@/components/ui/selection";
import { DataCardBodySkeleton } from "@/components/ui/skeleton";
import { equipmentTypesQuery } from "@/queries/standardsQueries";
import { dash } from "@/utils/statusUtils";

const units = (n: number) => `${n} unit${n === 1 ? "" : "s"}`;

export default function EquipmentTypesCard() {
  const query = useQuery(equipmentTypesQuery());
  const standards = query.data ?? [];

  const placeholder = query.isPending ? (
    <DataCardBodySkeleton rows={6} columns={6} label="Loading equipment types…" />
  ) : query.isError ? (
    <ErrorState what="equipment types" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
  ) : (
    standards.length === 0 && (
      <EmptyState
        icon={Construction}
        title="No equipment types yet"
        description="Add a type such as Excavator or Dump Truck and set its L/hr or L/km standard. Units you register use it by default."
        action={<AddEquipmentTypeButton />}
      />
    )
  );

  return (
    <SelectionProvider ids={standards.map((s) => s.id)}>
    <DataCard
      title="Standards by equipment type"
      description="Defaults applied to every unit of each type unless overridden per unit."
      flush
      action={
        query.isSuccess && (
          <div className="flex flex-wrap items-center gap-2">
            <StandardsSelectionBar types={standards} />
            <AddEquipmentTypeButton />
          </div>
        )
      }
      emptyState={placeholder}
    >
      <SelectAllBar label="standards" />
      <MobileList>
        {standards.map((standard) => (
          <SelectableRow key={standard.id} id={standard.id} as="li" className="px-5 py-4 sm:px-6">
            <MobileRecordHeader
              select={<RowCheckbox id={standard.id} label={`${standard.name} standard`} />}
              title={standard.name}
              subtitle={`${standard.measurementLabel} · ${units(standard.unitCount)}`}
              trailing={<StandardRowActions type={standard} />}
            />
            <MobileFields>
              <MobileField label="L/km standard"><span className="tabular-nums">{dash(standard.lKmStandard, 3)}</span></MobileField>
              <MobileField label="L/hr standard"><span className="tabular-nums">{dash(standard.lHrStandard, 2)}</span></MobileField>
            </MobileFields>
          </SelectableRow>
        ))}
      </MobileList>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-150 border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-400">
              <th scope="col" className="w-10 px-5 py-2.5 text-left sm:px-6">
                <SelectAllCheckbox label="standards" />
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Equipment type</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">L/km standard</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">L/hr standard</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Measurement</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Units</th>
              <th scope="col" className="px-5 py-2.5 text-right font-semibold sm:px-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {standards.map((standard) => (
              <SelectableRow key={standard.id} id={standard.id} className="transition-colors hover:bg-slate-50/70">
                <td className="px-5 py-3.5 sm:px-6">
                  <RowCheckbox id={standard.id} label={`${standard.name} standard`} />
                </td>
                <td className="px-3 py-3.5 font-medium text-slate-900">{standard.name}</td>
                <td className="px-3 py-3.5 text-right tabular-nums text-slate-700">{dash(standard.lKmStandard, 3)}</td>
                <td className="px-3 py-3.5 text-right tabular-nums text-slate-700">{dash(standard.lHrStandard, 2)}</td>
                <td className="px-3 py-3.5 text-slate-500">{standard.measurementLabel}</td>
                <td className="px-3 py-3.5 text-right tabular-nums text-slate-500">{standard.unitCount}</td>
                <td className="px-5 py-3.5 text-right sm:px-6">
                  <StandardRowActions type={standard} />
                </td>
              </SelectableRow>
            ))}
          </tbody>
        </table>
      </div>
    </DataCard>
    </SelectionProvider>
  );
}
