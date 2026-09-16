"use client";

import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Field, PrimaryButton, SecondaryButton, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { useUpdateUserProfile } from "@/queries/userMutations";
import { fieldErrors } from "@/queries/useActionMutation";
import type { AccountRow } from "@/types/account";

type Props = { open: boolean; onClose: () => void; account: AccountRow };

export default function EditUserModal({ open, ...props }: Props) {
  if (!open) return null;
  return <EditUserForm {...props} />;
}

function EditUserForm({ onClose, account }: Omit<Props, "open">) {
  const mutation = useUpdateUserProfile();
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);
  const formId = `edit-user-${account.id}`;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${account.name}`}
      description="Change the name or sign-in email. Use Change role to move them to another role or site."
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
              toast.success(`${account.name} updated`, { description: result.message });
              onClose();
            },
          });
        }}
      >
        <input type="hidden" name="id" value={account.id} />

        <Field label="Full name" htmlFor="eu-name" required error={errors?.name}>
          <TextInput id="eu-name" name="name" defaultValue={account.name} required maxLength={120} disabled={pending} />
        </Field>
        <Field label="Email address" htmlFor="eu-email" required hint="They sign in with this address" error={errors?.email}>
          <TextInput id="eu-email" name="email" type="email" defaultValue={account.email} required disabled={pending} />
        </Field>
      </form>
    </Modal>
  );
}
