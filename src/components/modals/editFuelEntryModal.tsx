"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { DerivedValue, Field, FieldRow, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import ErrorState from "@/components/ui/errorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpdateFuelEntry } from "@/queries/fuelEntryMutations";
import { fuelEntryDetailQuery, operatorsQuery } from "@/queries/fuelEntryQueries";
import { fieldErrors } from "@/queries/useActionMutation";
import type { FuelEntryDetail } from "@/types/fuelLog";
import { dateTimeInputValues } from "@/utils/formatDate";

type Props = { open: boolean; onClose: () => void; entryId: string; entryCode: string };

/** An administrator's direct edit of a submitted entry. Records takers request a correction instead. */
export default function EditFuelEntryModal({ open, ...props }: Props) {
  if (!open) return null;
  return <EntryLoader {...props} />;
}

function EntryLoader({ onClose, entryId, entryCode }: Omit<Props, "open">) {
  const detail = useQuery(fuelEntryDetailQuery(entryId));
  if (detail.isSuccess) return <EditForm onClose={onClose} entry={detail.data} />;

  return (
    <Modal open onClose={onClose} title={`Edit ${entryCode}`}>
      {detail.isError ? (
        <ErrorState size="sm" what="this entry" message={detail.error.message} onRetry={() => detail.refetch()} retrying={detail.isFetching} />
      ) : (
        <div role="status" className="space-y-5 pb-4">
          <span className="sr-only">Loading entry…</span>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function EditForm({ onClose, entry }: { onClose: () => void; entry: FuelEntryDetail }) {
  const operators = useQuery(operatorsQuery());
  const mutation = useUpdateFuelEntry();
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);
  const formId = `edit-entry-${entry.id}`;

  const when = dateTimeInputValues(entry.dispensedAt);
  const km = entry.equipment.basis === "km";
  const meter = km
    ? { legend: "Odometer readings", startName: "odometerStart", endName: "odometerEnd", start: entry.odometerStart, end: entry.odometerEnd }
    : { legend: "Hour-meter readings", startName: "hourMeterStart", endName: "hourMeterEnd", start: entry.hourMeterStart, end: entry.hourMeterEnd };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${entry.code}`}
      description={`Recorded by ${entry.recorder.name}. Saving re-checks the entry against its consumption standard and can raise new alerts.`}
      size="lg"
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : "Save changes"}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onClose} disabled={pending}>
            Cancel
          </SecondaryButton>
        </>
      }
    >
      <form
        id={formId}
        className="space-y-4 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(new FormData(event.currentTarget), {
            onSuccess: (result) => {
              toast.success(`${entry.code} updated`, { description: result.message });
              onClose();
            },
          });
        }}
      >
        <input type="hidden" name="id" value={entry.id} />
        {/* Moving an entry to other equipment or another tanker would rewrite two sets of figures. */}
        <input type="hidden" name="equipmentId" value={entry.equipment.id} />
        <input type="hidden" name="tankId" value={entry.tank.id} />

        <FieldRow>
          <DerivedValue label="Equipment" value={`${entry.equipment.code} · ${entry.equipment.typeName}`} />
          <DerivedValue label="Drawn from" value={entry.tank.name} />
        </FieldRow>

        <FieldRow>
          <Field label="Date" htmlFor="ee-date" required error={errors?.dispensedAt}>
            <TextInput id="ee-date" name="date" type="date" defaultValue={when.date} required disabled={pending} />
          </Field>
          <Field label="Time" htmlFor="ee-time" required hint="Accra time">
            <TextInput id="ee-time" name="time" type="time" defaultValue={when.time} required disabled={pending} />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Driver / operator" htmlFor="ee-operator" required error={errors?.operatorId}>
            <SelectInput id="ee-operator" name="operatorId" defaultValue={entry.operator.id} required disabled={pending || operators.isPending}>
              {/* Kept even if they're no longer active, so the value only changes when someone picks another. */}
              <option value={entry.operator.id}>{entry.operator.name}</option>
              {operators.data?.filter((o) => o.id !== entry.operator.id).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Litres" htmlFor="ee-litres" required error={errors?.litres}>
            <TextInput
              id="ee-litres"
              name="litres"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              defaultValue={entry.litres}
              required
              disabled={pending}
            />
          </Field>
        </FieldRow>

        <fieldset className="rounded-xl border border-slate-200 p-4" disabled={pending}>
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">{meter.legend}</legend>
          <FieldRow>
            <Field label="Start" htmlFor="ee-meter-start" error={errors?.[meter.startName]}>
              <TextInput id="ee-meter-start" name={meter.startName} type="number" inputMode="decimal" min="0" step="0.1" defaultValue={meter.start ?? ""} />
            </Field>
            <Field label="End" htmlFor="ee-meter-end" error={errors?.[meter.endName]}>
              <TextInput id="ee-meter-end" name={meter.endName} type="number" inputMode="decimal" min="0" step="0.1" defaultValue={meter.end ?? ""} />
            </Field>
          </FieldRow>
        </fieldset>

        <Field label="Activity" htmlFor="ee-loc" required hint="Where on site, and what it was doing" error={errors?.locationActivity}>
          <TextInput id="ee-loc" name="locationActivity" defaultValue={entry.locationActivity} required maxLength={200} disabled={pending} />
        </Field>
      </form>
    </Modal>
  );
}
