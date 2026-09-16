"use client";

import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Field, PrimaryButton, SecondaryButton, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { useUpdateThresholds } from "@/queries/standardsMutations";
import { fieldErrors } from "@/queries/useActionMutation";
import type { AlertThreshold } from "@/types/standards";

const DEFAULTS: AlertThreshold[] = [
  { level: "watch", label: "Watch", percent: 5 },
  { level: "high", label: "High / flagged", percent: 15 },
  { level: "critical", label: "Critical", percent: 25 },
];

const HINTS: Record<AlertThreshold["level"], string> = {
  watch: "Listed on the watchlist",
  high: "Entry is flagged for review",
  critical: "Most serious alerts",
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** `null` when the thresholds haven't been set up yet; the form starts from the usual defaults. */
  thresholds: AlertThreshold[] | null;
};

export default function EditThresholdsModal({ open, ...props }: Props) {
  // Mount the form only while open, so each opening starts with fresh state.
  if (!open) return null;
  return <EditThresholdsForm {...props} />;
}

function EditThresholdsForm({ onClose, thresholds }: Omit<Props, "open">) {
  const mutation = useUpdateThresholds();
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);
  const levels = thresholds ?? DEFAULTS;

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit alert thresholds"
      description="% variance above a unit's standard that triggers each severity. Each level must be higher than the one before."
      footer={
        <>
          <PrimaryButton type="submit" form="edit-thresholds" disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : "Save thresholds"}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onClose} disabled={pending}>
            Cancel
          </SecondaryButton>
        </>
      }
    >
      <form
        id="edit-thresholds"
        className="space-y-4 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(new FormData(event.currentTarget), {
            onSuccess: (result) => {
              toast.success("Thresholds saved", { description: result.message });
              onClose();
            },
          });
        }}
      >

        {levels.map((threshold) => {
          const id = `threshold-${threshold.level}`;
          const error = errors?.[threshold.level];
          return (
            <Field key={threshold.level} label={`${threshold.label} (%)`} htmlFor={id} required hint={HINTS[threshold.level]} error={error}>
              <TextInput
                id={id}
                name={threshold.level}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                defaultValue={threshold.percent}
                disabled={pending}
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? `${id}-error` : undefined}
              />
            </Field>
          );
        })}

        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          New fuel entries use these straight away. Alerts that were already raised keep their severity.
        </p>
      </form>
    </Modal>
  );
}
