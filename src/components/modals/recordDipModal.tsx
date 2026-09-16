"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field, FieldRow, PrimaryButton, SecondaryButton, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { useRecordDip } from "@/queries/tankMutations";
import { fieldErrors } from "@/queries/useActionMutation";
import { dateTimeInputValues } from "@/utils/formatDate";

export type DipTarget = {
  id: string;
  code: string;
  name: string;
  /** Shown as a hint when known. */
  capacityL?: number;
  currentL?: number | null;
};

type Props = { open: boolean; onClose: () => void; tank: DipTarget };

export default function RecordDipModal({ open, ...props }: Props) {
  // Mount only while open, so each opening starts with the current time.
  if (!open) return null;
  return <RecordDipForm {...props} />;
}

function RecordDipForm({ onClose, tank }: Omit<Props, "open">) {
  const [now] = useState(() => dateTimeInputValues());
  const mutation = useRecordDip();
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);
  const formId = `record-dip-${tank.id}`;

  const hint = [
    tank.capacityL !== undefined && `Capacity ${tank.capacityL.toLocaleString()} L`,
    // What the records say it should be; the dip is what it actually is.
    tank.currentL !== undefined && tank.currentL !== null && `records show ${tank.currentL.toLocaleString()} L`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Modal
      open
      onClose={onClose}
      title={`Record dip for ${tank.name}`}
      description={`${tank.code}. The measured level drives the tank card and the stock reconciliation. One dip a day keeps both accurate.`}
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : "Save dip"}
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
              toast.success(`Dip recorded for ${tank.name}`, { description: result.message });
              onClose();
            },
          });
        }}
      >
        <input type="hidden" name="tankId" value={tank.id} />

        <Field label="Measured level (L)" htmlFor="dip-litres" required hint={hint || undefined} error={errors?.measuredL}>
          <TextInput
            id="dip-litres"
            name="measuredL"
            type="number"
            inputMode="decimal"
            min="0"
            max={tank.capacityL}
            step="0.01"
            required
            disabled={pending}
          />
        </Field>

        <FieldRow>
          <Field label="Date" htmlFor="dip-date" required error={errors?.measuredAt}>
            <TextInput id="dip-date" name="date" type="date" defaultValue={now.date} max={now.date} required disabled={pending} />
          </Field>
          <Field label="Time" htmlFor="dip-time" required hint="Accra time">
            <TextInput id="dip-time" name="time" type="time" defaultValue={now.time} required disabled={pending} />
          </Field>
        </FieldRow>

        <Field label="Note" htmlFor="dip-note" hint="Optional, e.g. closing dip for September">
          <TextInput id="dip-note" name="note" maxLength={200} disabled={pending} />
        </Field>
      </form>
    </Modal>
  );
}
