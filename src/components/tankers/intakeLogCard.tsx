"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, Truck } from "lucide-react";

import { RecordIntakeButton } from "@/components/modals/triggers";
import { IntakeRowActions } from "@/components/tankers/intakeRowActions";
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
import { intakesQuery, tanksQuery } from "@/queries/tankQueries";
import type { IntakeRow } from "@/types/tank";
import { formatDateTime } from "@/utils/formatDate";

function VoidPill() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
      <Ban className="h-3 w-3 shrink-0" aria-hidden />
      Void
    </span>
  );
}

const ghs = (n: number) => `GHS ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The delivery note, the unit price and who received it — the paperwork, out of the way until asked for. */
function IntakeDetails({ intake, id, flush = false }: { intake: IntakeRow; id: string; flush?: boolean }) {
  return (
    <DetailPanel id={id} flush={flush}>
      <DetailGroup title="Delivery">
        <DetailItem label="Intake">{intake.code}</DetailItem>
        <DetailItem label="Delivery note">{intake.deliveryNote}</DetailItem>
        <DetailItem label="Tanker">{intake.tankName}</DetailItem>
      </DetailGroup>

      <DetailGroup title="Cost">
        <DetailItem label="Total" emphasis>
          {ghs(intake.totalCost)}
        </DetailItem>
        <DetailItem label="Price per litre">{intake.costPerLitre.toFixed(3)}</DetailItem>
        <DetailItem label="Litres received">{intake.litres.toLocaleString()} L</DetailItem>
      </DetailGroup>

      <DetailGroup title="Record">
        <DetailItem label="Received by">{intake.receivedBy}</DetailItem>
        <DetailItem label="Received at">{formatDateTime(intake.receivedAt)}</DetailItem>
        {intake.voidedAt && <DetailItem label="Void reason">{intake.voidReason ?? "No reason given"}</DetailItem>}
      </DetailGroup>
    </DetailPanel>
  );
}

function IntakeTableRow({ intake }: { intake: IntakeRow }) {
  const details = useDisclosure();
  return (
    <>
      <SelectableRow
        id={intake.id}
        className={`transition-colors hover:bg-slate-50/70 ${intake.voidedAt ? "opacity-70" : ""}`}
      >
        <td className="px-5 py-4 sm:px-6">
          <RowCheckbox id={intake.id} label={intake.code} />
        </td>
        <td className="px-3 py-4 whitespace-nowrap tabular-nums text-slate-500">{formatDateTime(intake.receivedAt)}</td>
        <td className="px-3 py-4">
          <span className={`block font-medium text-slate-900 ${intake.voidedAt ? "line-through" : ""}`}>{intake.tankName}</span>
          <span className="block text-sm text-slate-500">{intake.supplier}</span>
        </td>
        <td className="px-3 py-4 text-right">
          <span className="font-semibold tabular-nums text-slate-900">{intake.litres.toLocaleString()}</span>
          <span className="ml-1 text-slate-400">L</span>
        </td>
        <td className="px-3 py-4 text-right tabular-nums text-slate-700">{ghs(intake.totalCost)}</td>
        <td className="px-3 py-4 text-right">{intake.voidedAt && <VoidPill />}</td>
        <td className="px-5 py-4 sm:px-6">
          <div className="flex items-center justify-end gap-1">
            <ExpandButton {...details.buttonProps} label={`details for ${intake.code}`} />
            <IntakeRowActions intake={intake} />
          </div>
        </td>
      </SelectableRow>
      {details.open && (
        <tr>
          <td colSpan={7} className="p-0">
            <IntakeDetails intake={intake} id={details.panelId} flush />
          </td>
        </tr>
      )}
    </>
  );
}

function IntakeCard({ intake }: { intake: IntakeRow }) {
  const details = useDisclosure();
  return (
    <SelectableRow id={intake.id} as="li" className={intake.voidedAt ? "opacity-70" : ""}>
      <div className="px-5 py-4 sm:px-6">
        <MobileRecordHeader
          select={<RowCheckbox id={intake.id} label={intake.code} />}
          title={<span className={intake.voidedAt ? "line-through" : ""}>{intake.tankName}</span>}
          subtitle={intake.voidedAt ? `Void — ${intake.voidReason ?? "no reason given"}` : intake.supplier}
          trailing={
            <>
              {intake.voidedAt && <VoidPill />}
              <IntakeRowActions intake={intake} />
            </>
          }
        />
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl font-semibold tabular-nums text-slate-900">{intake.litres.toLocaleString()}</span>
          <span className="text-slate-400">L</span>
          <span className="ml-auto text-sm tabular-nums text-slate-500">{formatDateTime(intake.receivedAt)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="text-sm tabular-nums text-slate-500">{ghs(intake.totalCost)}</span>
          <ExpandButton {...details.buttonProps} label={`details for ${intake.code}`} variant="text" />
        </div>
      </div>
      {details.open && <IntakeDetails intake={intake} id={details.panelId} />}
    </SelectableRow>
  );
}

/** A delivery recorded in error is voided, not deleted: it stays in the log but drops out of stock, costs and the reconciliation. */
export default function IntakeLogCard({ currentUserId }: { currentUserId: string }) {
  const query = useQuery(intakesQuery());
  const tanks = useQuery(tanksQuery());
  const intakes = query.data ?? [];

  const placeholder = query.isPending ? (
    <DataCardBodySkeleton rows={5} columns={7} label="Loading intake log…" />
  ) : query.isError ? (
    <ErrorState what="the intake log" message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />
  ) : (
    intakes.length === 0 && (
      <EmptyState
        icon={Truck}
        title="No deliveries recorded"
        description="Record each delivery taken into a tanker, with its supplier and delivery note."
        action={(tanks.data?.length ?? 0) > 0 && <RecordIntakeButton currentUserId={currentUserId} />}
      />
    )
  );

  return (
    <SelectionProvider ids={intakes.map((i) => i.id)}>
    <DataCard
      title="Intake log"
      description="The 50 most recent deliveries received into a tanker, with supplier and delivery note."
      flush
      action={query.isSuccess && <SelectionBar noun="intake" actions={["export"]} />}
      emptyState={placeholder}
    >
      <SelectAllBar label="intakes" />
      <MobileList>
        {intakes.map((intake) => (
          <IntakeCard key={intake.id} intake={intake} />
        ))}
      </MobileList>
      <div className="hidden lg:block">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wider text-slate-400">
              <th scope="col" className="w-10 px-5 py-3 text-left sm:px-6">
                <SelectAllCheckbox label="intakes" />
              </th>
              <th scope="col" className="px-3 py-3 text-left font-semibold">Received</th>
              <th scope="col" className="px-3 py-3 text-left font-semibold">Tanker / supplier</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Litres</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Cost</th>
              <th scope="col" className="w-20 px-3 py-3 text-right font-semibold">
                <span className="sr-only">Void</span>
              </th>
              <th scope="col" className="w-24 px-5 py-3 text-right font-semibold sm:px-6">
                <span className="sr-only">Details and actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {intakes.map((intake) => (
              <IntakeTableRow key={intake.id} intake={intake} />
            ))}
          </tbody>
        </table>
      </div>
    </DataCard>
    </SelectionProvider>
  );
}
