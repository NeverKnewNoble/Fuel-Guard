"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Field, FieldRow, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import ErrorState from "@/components/ui/errorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequestCorrection } from "@/queries/fuelEntryMutations";
import { fuelEntryDetailQuery, operatorsQuery } from "@/queries/fuelEntryQueries";
import { fieldErrors } from "@/queries/useActionMutation";
import type { FuelEntryDetail } from "@/types/fuelLog";
import { dateTimeInputValues, formatDateTime } from "@/utils/formatDate";

type Props = { open: boolean; onClose: () => void; entryId: string; entryCode: string };

export default function RequestCorrectionModal({ open, ...props }: Props) {
  if (!open) return null;
  return <CorrectionLoader {...props} />;
}

/** The form starts from the entry's current values, so only what the user changes is sent. */
function CorrectionLoader({ onClose, entryId, entryCode }: Omit<Props, "open">) {
  const detail = useQuery(fuelEntryDetailQuery(entryId));
  if (detail.isSuccess) return <CorrectionForm onClose={onClose} entry={detail.data} />;

  return (
    <Modal open onClose={onClose} title={`Request correction — ${entryCode}`}>
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

function CorrectionForm({ onClose, entry }: { onClose: () => void; entry: FuelEntryDetail }) {
  const operators = useQuery(operatorsQuery());
  const mutation = useRequestCorrection();
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);
  const formId = `correct-${entry.id}`;

  const when = dateTimeInputValues(entry.dispensedAt);
  const km = entry.equipment.basis === "km";
  const meter = km
    ? { legend: "Odometer readings", startName: "odometerStart", endName: "odometerEnd", start: entry.odometerStart, end: entry.odometerEnd }
    : { legend: "Hour-meter readings", startName: "hourMeterStart", endName: "hourMeterEnd", start: entry.hourMeterStart, end: entry.hourMeterEnd };

  const history = entry.corrections;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Request correction — ${entry.code}`}
      description={`${entry.equipment.code} · ${entry.equipment.typeName}, recorded by ${entry.recorder.name}. An administrator reviews every change.`}
      size="lg"
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Sending…" : "Send request"}
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
              toast.success("Correction requested", { description: result.message });
              onClose();
            },
          });
        }}
      >
        <input type="hidden" name="fuelEntryId" value={entry.id} />

        <FieldRow>
          <Field label="Date" htmlFor="rc-date" required error={errors?.dispensedAt}>
            <TextInput id="rc-date" name="date" type="date" defaultValue={when.date} required disabled={pending} />
          </Field>
          <Field label="Time" htmlFor="rc-time" required hint="Accra time">
            <TextInput id="rc-time" name="time" type="time" defaultValue={when.time} required disabled={pending} />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Driver / operator" htmlFor="rc-operator" required error={errors?.operatorId}>
            <SelectInput id="rc-operator" name="operatorId" defaultValue={entry.operator.id} required disabled={pending || operators.isPending}>
              {/* Kept even if they're no longer active, so the value only changes when the user picks another. */}
              <option value={entry.operator.id}>{entry.operator.name}</option>
              {operators.data?.filter((o) => o.id !== entry.operator.id).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Litres" htmlFor="rc-litres" required error={errors?.litres}>
            <TextInput
              id="rc-litres"
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
            <Field label="Start" htmlFor="rc-meter-start" error={errors?.[meter.startName]}>
              <TextInput id="rc-meter-start" name={meter.startName} type="number" inputMode="decimal" min="0" step="0.1" defaultValue={meter.start ?? ""} />
            </Field>
            <Field label="End" htmlFor="rc-meter-end" error={errors?.[meter.endName]}>
              <TextInput id="rc-meter-end" name={meter.endName} type="number" inputMode="decimal" min="0" step="0.1" defaultValue={meter.end ?? ""} />
            </Field>
          </FieldRow>
        </fieldset>

        <Field label="Location & activity" htmlFor="rc-loc" required error={errors?.locationActivity}>
          <TextInput id="rc-loc" name="locationActivity" defaultValue={entry.locationActivity} required maxLength={200} disabled={pending} />
        </Field>

        <Field label="Reason for the correction" htmlFor="rc-reason" required hint="What was wrong, and how you know" error={errors?.reason}>
          <TextInput id="rc-reason" name="reason" placeholder="Litres mistyped — the pump ticket shows 201 L" required maxLength={300} disabled={pending} />
        </Field>

        {history.length > 0 && (
          <div className="rounded-xl bg-slate-50 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Earlier requests</p>
            <ul className="mt-2 space-y-2">
              {history.map((correction) => (
                <li key={correction.id} className="text-sm text-slate-600">
                  <span className="font-medium capitalize text-slate-900">{correction.status}</span>
                  <span className="text-slate-400"> · {formatDateTime(correction.createdAt)} · {correction.requestedBy.name}</span>
                  <span className="block text-xs text-slate-500">{correction.changes.map((c) => c.text).join(" · ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  );
}
