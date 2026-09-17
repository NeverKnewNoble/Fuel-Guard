"use client";

import { useQuery } from "@tanstack/react-query";
import { Truck } from "lucide-react";

import { EquipmentRowActions } from "@/components/equipment/equipmentRowActions";
import { AddEquipmentButton } from "@/components/modals/triggers";
import DataCard from "@/components/ui/dataCard";
import EmptyState from "@/components/ui/emptyState";
import ErrorState from "@/components/ui/errorState";
import {
  DetailGroup,
  DetailItem,
  DetailPanel,
  ExpandButton,
  useDisclosure,
} from "@/components/ui/detailDisclosure";
import { MobileList, MobileRecordHeader } from "@/components/ui/mobileList";
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
import type { EquipmentRow } from "@/types/equipment";
import { dash, equipmentStatusStyles } from "@/utils/statusUtils";

/** Make and model, both standards, and which one actually applies to this unit. */
function UnitDetails({ unit, id, flush = false }: { unit: EquipmentRow; id: string; flush?: boolean }) {
  const km = unit.basis === "km";
  return (
    <DetailPanel id={id} flush={flush}>
      <DetailGroup title="Unit">
        <DetailItem label="Equipment ID">{unit.code}</DetailItem>
        <DetailItem label="Type">{unit.typeName}</DetailItem>
        <DetailItem label="Make / model">{unit.makeModel}</DetailItem>
      </DetailGroup>

      <DetailGroup title="Consumption standard">
        <DetailItem label="Measured by" emphasis>
          {km ? "Distance (km)" : "Running hours"}
        </DetailItem>
        <DetailItem label="L/km standard">{dash(unit.lKmStd, 3)}</DetailItem>
        <DetailItem label="L/hr standard">{dash(unit.lHrStd, 2)}</DetailItem>
      </DetailGroup>

      <DetailGroup title="Posting">
        <DetailItem label="Assigned site">{unit.siteName}</DetailItem>
        <DetailItem label="Status">{equipmentStatusStyles[unit.status].label}</DetailItem>
      </DetailGroup>
    </DetailPanel>
  );
}

function UnitTableRow({ unit }: { unit: EquipmentRow }) {
  const details = useDisclosure();
  const km = unit.basis === "km";
  return (
    <>
      <SelectableRow
        id={unit.id}
        className={`transition-colors hover:bg-slate-50/70 ${unit.status === "retired" ? "opacity-70" : ""}`}
      >
        <td className="px-5 py-4 sm:px-6">
          <RowCheckbox id={unit.id} label={unit.code} />
        </td>
        <td className="px-3 py-4">
          <span className="block font-medium text-slate-900">{unit.code}</span>
          <span className="block text-sm text-slate-500">{unit.typeName}</span>
        </td>
        <td className="px-3 py-4 text-slate-500">{unit.siteName}</td>
        <td className="px-3 py-4 text-right">
          <span className="tabular-nums text-slate-700">{km ? dash(unit.lKmStd, 3) : dash(unit.lHrStd, 2)}</span>
          <span className="ml-1 text-slate-400">{km ? "L/km" : "L/hr"}</span>
        </td>
        <td className="px-3 py-4 text-right">
          <StatusPill {...equipmentStatusStyles[unit.status]} />
        </td>
        <td className="px-5 py-4 sm:px-6">
          <div className="flex items-center justify-end gap-1">
            <ExpandButton {...details.buttonProps} label={`details for ${unit.code}`} />
            <EquipmentRowActions unit={unit} />
          </div>
        </td>
      </SelectableRow>
      {details.open && (
        <tr>
          <td colSpan={6} className="p-0">
            <UnitDetails unit={unit} id={details.panelId} flush />
          </td>
        </tr>
      )}
    </>
  );
}

function UnitCard({ unit }: { unit: EquipmentRow }) {
  const details = useDisclosure();
  const km = unit.basis === "km";
  return (
    <SelectableRow id={unit.id} as="li" className={unit.status === "retired" ? "opacity-70" : ""}>
      <div className="px-5 py-4 sm:px-6">
        <MobileRecordHeader
          select={<RowCheckbox id={unit.id} label={unit.code} />}
          title={unit.code}
          subtitle={`${unit.typeName} · ${unit.siteName}`}
          trailing={
            <>
              <StatusPill {...equipmentStatusStyles[unit.status]} />
              <EquipmentRowActions unit={unit} />
            </>
          }
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-sm tabular-nums text-slate-500">
            {km ? dash(unit.lKmStd, 3) : dash(unit.lHrStd, 2)} <span className="text-slate-400">{km ? "L/km" : "L/hr"}</span>
          </span>
          <ExpandButton {...details.buttonProps} label={`details for ${unit.code}`} variant="text" />
        </div>
      </div>
      {details.open && <UnitDetails unit={unit} id={details.panelId} />}
    </SelectableRow>
  );
}

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
          <UnitCard key={unit.id} unit={unit} />
        ))}
      </MobileList>
      <div className="hidden lg:block">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wider text-slate-400">
              <th scope="col" className="w-10 px-5 py-3 text-left sm:px-6">
                <SelectAllCheckbox label="units" />
              </th>
              <th scope="col" className="px-3 py-3 text-left font-semibold">Equipment</th>
              <th scope="col" className="px-3 py-3 text-left font-semibold">Assigned site</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Standard</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Status</th>
              <th scope="col" className="w-24 px-5 py-3 text-right font-semibold sm:px-6">
                <span className="sr-only">Details and actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {units.map((unit) => (
              <UnitTableRow key={unit.id} unit={unit} />
            ))}
          </tbody>
        </table>
      </div>
    </DataCard>
    </SelectionProvider>
  );
}
