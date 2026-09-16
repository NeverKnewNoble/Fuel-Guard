"use client";

import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Field, PrimaryButton, SecondaryButton, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { useRejectCorrection } from "@/queries/fuelEntryMutations";
import { fieldErrors } from "@/queries/useActionMutation";
import type { PendingCorrectionRow } from "@/types/fuelLog";

type Props = { open: boolean; onClose: () => void; correction: PendingCorrectionRow };

export default function RejectCorrectionModal({ open, ...props }: Props) {
  if (!open) return null;
  return <RejectForm {...props} />;
}

function RejectForm({ onClose, correction }: Omit<Props, "open">) {
  const mutation = useRejectCorrection();
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);
  const formId = `reject-${correction.id}`;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reject correction for ${correction.entryCode}?`}
      description={`Requested by ${correction.requestedBy.name}: "${correction.reason}"`}
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Rejecting…" : "Reject request"}
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
              toast.success("Correction rejected", { description: result.message });
              onClose();
            },
          });
        }}
      >
        <input type="hidden" name="id" value={correction.id} />

        <Field label="Why it's rejected" htmlFor="rj-note" required hint="Recorded in the audit log so the requester can be told" error={errors?.note}>
          <TextInput id="rj-note" name="note" placeholder="The pump ticket matches the original reading" required maxLength={300} disabled={pending} />
        </Field>
      </form>
    </Modal>
  );
}
