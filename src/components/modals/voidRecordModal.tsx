"use client";

import { LoaderCircle, Undo2 } from "lucide-react";
import type { ReactNode } from "react";

import { Field, PrimaryButton, SecondaryButton, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Receives the typed reason. */
  onConfirm: (reason: string) => void;
  title: string;
  description?: string;
  /** Explains what voiding does to the figures. */
  children?: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  error?: string;
};

/**
 * Asks why a record is being voided. Voiding keeps the row in its list but takes it out of the
 * figures, so the reason is what explains the change to whoever reads the audit log later.
 */
export default function VoidRecordModal({ open, ...props }: Props) {
  if (!open) return null;
  return <VoidForm {...props} />;
}

function VoidForm({ onClose, onConfirm, title, description, children, confirmLabel = "Void", pending = false, error }: Omit<Props, "open">) {
  return (
    <Modal
      open
      onClose={pending ? () => {} : onClose}
      title={title}
      description={description}
      footer={
        <>
          <PrimaryButton type="submit" form="void-record" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Undo2 className="h-4 w-4" aria-hidden />}
            {pending ? "Voiding…" : confirmLabel}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onClose} disabled={pending}>
            Cancel
          </SecondaryButton>
        </>
      }
    >
      <form
        id="void-record"
        className="space-y-4 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(String(new FormData(event.currentTarget).get("reason") ?? ""));
        }}
      >
        {children}
        <Field label="Why is it void?" htmlFor="void-reason" required hint="Kept with your name, and shown on the row" error={error}>
          <TextInput id="void-reason" name="reason" placeholder="Recorded twice by mistake" required maxLength={300} disabled={pending} />
        </Field>
      </form>
    </Modal>
  );
}
