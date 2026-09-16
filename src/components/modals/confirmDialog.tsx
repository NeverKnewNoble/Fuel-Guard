"use client";

import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

import { PrimaryButton, SecondaryButton } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  /** Extra detail under the description, e.g. what happens to related records. */
  children?: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
};

/** "Are you sure?" for a single action that doesn't need a form, e.g. retiring a unit or disabling an account. */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel,
  pendingLabel = "Working…",
  pending = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={pending ? () => {} : onClose}
      title={title}
      description={description}
      footer={
        <>
          <PrimaryButton type="button" onClick={onConfirm} disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? pendingLabel : confirmLabel}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onClose} disabled={pending}>
            Cancel
          </SecondaryButton>
        </>
      }
    >
      {/* Failures are reported as a toast by `useActionMutation`, so the dialog just stays open. */}
      <div className="space-y-4 pb-2">{children}</div>
    </Modal>
  );
}
