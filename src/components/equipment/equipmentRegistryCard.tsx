"use client";

import { useQuery } from "@tanstack/react-query";
import { Truck } from "lucide-react";

import { EquipmentRowActions } from "@/components/equipment/equipmentRowActions";
import { AddEquipmentButton } from "@/components/modals/triggers";
import DataCard from "@/components/ui/dataCard";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import { MobileField, MobileFields, MobileList, MobileRecordHeader } from "@/components/ui/mobileList";
import {
  RowCheckbox,
  SelectAllBar,
  SelectAllCheckbox,
  SelectableRow,
  SelectionBar,
  SelectionProvider,
} from "@/components/ui/selection";
import { DataCardBodySkeleton } from "@/components/ui/skeleton";
import StatusPill from "@/components/ui/statusPill";
import { equipmentListQuery } from "@/queries/equipmentQueries";
import { dash, equipmentStatusStyles } from "@/utils/statusUtils";

export default function EquipmentRegistryCard() {
  const query = useQuery(equipmentListQuery());
  const units = query.data ?? [];

  const placeholder = query.isPending ? (
    <DataCardBodySkeleton rows={8} columns={7} label="Loading equipment…" />
  ) : query.isError ? (
    <ErrorState what="the equipment registry" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
  ) : (
    units.length === 0 && (
      <EmptyState
        icon={Truck}
        title="No equipment registered yet"
        description="Add each unit that draws fuel so its entries can be checked against a consumption standard."
        action={<AddEquipmentButton />}
      />
    )
  );

  return (
    <SelectionProvider ids={units.map((u) => u.id)}>
    <DataCard
      title="Registry"
      description={
        query.isSuccess
          ? `${units.length} registered unit${units.length === 1 ? "" : "s"}, each with its consumption standard.`
          : "Every unit that draws fuel, with its consumption standard."
      }
      flush
      // Equipment is retired, never deleted (fuel entries point at it), so there's no bulk Delete.
      action={query.isSuccess && <SelectionBar noun="unit" actions={["export"]} />}
      emptyState={placeholder}
    >
      <SelectAllBar label="units" />
      <MobileList>
        {units.map((unit) => (
          <SelectableRow key={unit.id} id={unit.id} as="li" className={`px-5 py-4 sm:px-6 ${unit.status === "retired" ? "opacity-70" : ""}`}>
            <MobileRecordHeader
              select={<RowCheckbox id={unit.id} label={unit.code} />}
              title={<><span className="font-mono">{unit.code}</span> · {unit.typeName}</>}
              subtitle={unit.makeModel}
              trailing={
                <>
                  <StatusPill {...equipmentStatusStyles[unit.status]} />
                  <EquipmentRowActions unit={unit} />
                </>
              }
            />
            <MobileFields>
              <MobileField label="Site" className="col-span-2 sm:col-span-1">{unit.siteName}</MobileField>
              <MobileField label="L/km std"><span className="tabular-nums">{dash(unit.lKmStd, 3)}</span></MobileField>
              <MobileField label="L/hr std"><span className="tabular-nums">{dash(unit.lHrStd, 2)}</span></MobileField>
            </MobileFields>
          </SelectableRow>
        ))}
      </MobileList>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-215 border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-400">
              <th scope="col" className="w-10 px-5 py-2.5 text-left sm:px-6">
                <SelectAllCheckbox label="units" />
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Equipment ID</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Type</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Make / model</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Assigned site</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">L/km std</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">L/hr std</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Status</th>
              <th scope="col" className="px-5 py-2.5 text-right font-semibold sm:px-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {units.map((unit) => (
              <SelectableRow
                key={unit.id}
                id={unit.id}
                className={`transition-colors hover:bg-slate-50/70 ${unit.status === "retired" ? "text-slate-400" : ""}`}
              >
                <td className="px-5 py-3.5 sm:px-6">
                  <RowCheckbox id={unit.id} label={unit.code} />
                </td>
                <td className="px-3 py-3.5 font-mono text-sm font-semibold text-slate-900">{unit.code}</td>
                <td className="px-3 py-3.5 text-slate-700">{unit.typeName}</td>
                <td className="px-3 py-3.5 text-slate-500">{unit.makeModel}</td>
                <td className="px-3 py-3.5 text-slate-500">{unit.siteName}</td>
                <td className="px-3 py-3.5 text-right tabular-nums text-slate-700">{dash(unit.lKmStd, 3)}</td>
                <td className="px-3 py-3.5 text-right tabular-nums text-slate-700">{dash(unit.lHrStd, 2)}</td>
                <td className="px-3 py-3.5 text-right">
                  <StatusPill {...equipmentStatusStyles[unit.status]} />
                </td>
                <td className="px-5 py-3.5 text-right sm:px-6">
                  <EquipmentRowActions unit={unit} />
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
