"use client";

import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Field, PrimaryButton, SecondaryButton, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { useSetUserPassword } from "@/queries/userMutations";
import { fieldErrors } from "@/queries/useActionMutation";
import type { AccountRow } from "@/types/account";

type Props = { open: boolean; onClose: () => void; account: AccountRow };

export default function SetPasswordModal({ open, ...props }: Props) {
  if (!open) return null;
  return <SetPasswordForm {...props} />;
}

function SetPasswordForm({ onClose, account }: Omit<Props, "open">) {
  const mutation = useSetUserPassword();
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);
  const formId = `set-password-${account.id}`;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Set password for ${account.name}`}
      description={
        account.status === "invited"
          ? "Their account is invited. Setting a password activates it so they can sign in."
          : "Replaces their current password. Their current session isn't signed out."
      }
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : "Set password"}
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
              toast.success(`Password set for ${account.name}`, { description: result.message });
              onClose();
            },
          });
        }}
      >
        <input type="hidden" name="id" value={account.id} />
        {/* Lets password managers attach the new password to the right account. */}
        <input type="hidden" name="username" autoComplete="username" value={account.email} />

        <Field label="New password" htmlFor="sp-password" required hint="At least 8 characters" error={errors?.password}>
          <TextInput id="sp-password" name="password" type="password" minLength={8} required autoComplete="new-password" disabled={pending} />
        </Field>
        <Field label="Confirm password" htmlFor="sp-confirm" required error={errors?.confirmPassword}>
          <TextInput id="sp-confirm" name="confirmPassword" type="password" required autoComplete="new-password" disabled={pending} />
        </Field>
      </form>
    </Modal>
  );
}
