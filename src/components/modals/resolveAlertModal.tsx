"use client";

import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Field, PrimaryButton, SecondaryButton, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { useResolveAlert } from "@/queries/alertMutations";
import { fieldErrors } from "@/queries/useActionMutation";
import type { AlertRow } from "@/types/alerts";

type Props = { open: boolean; onClose: () => void; alert: AlertRow };

export default function ResolveAlertModal({ open, ...props }: Props) {
  if (!open) return null;
  return <ResolveForm {...props} />;
}

function ResolveForm({ onClose, alert }: Omit<Props, "open">) {
  const mutation = useResolveAlert();
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);
  const formId = `resolve-${alert.id}`;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Resolve ${alert.code}?`}
      description={`${alert.equipmentCode} · ${alert.equipmentName} at ${alert.siteName}. ${alert.summary}`}
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Resolving…" : "Resolve alert"}
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
              toast.success(`${alert.code} resolved`, { description: result.message });
              onClose();
            },
          });
        }}
      >
        <input type="hidden" name="id" value={alert.id} />

        <Field
          label="What did you find?"
          htmlFor="ra-note"
          required
          hint="Recorded with your name, so the decision can be explained later"
          error={errors?.note}
        >
          <TextInput
            id="ra-note"
            name="note"
            placeholder="Meter reading was mistyped; corrected entry matches the pump ticket"
            required
            maxLength={300}
            disabled={pending}
          />
        </Field>
      </form>
    </Modal>
  );
}
