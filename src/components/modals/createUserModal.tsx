"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field, FieldRow, PrimaryButton, SecondaryButton, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { RoleAndSiteFields } from "@/components/users/roleAndSiteFields";
import { useCreateUser } from "@/queries/userMutations";
import { fieldErrors } from "@/queries/useActionMutation";
import type { AppUserRole } from "@/types/next-auth";

type Props = { open: boolean; onClose: () => void };

export default function CreateUserModal({ open, onClose }: Props) {
  // Mount only while open, so each opening starts with fresh state.
  if (!open) return null;
  return <CreateUserForm onClose={onClose} />;
}

function CreateUserForm({ onClose }: { onClose: () => void }) {
  const [role, setRole] = useState<AppUserRole>("records_taker");
  const mutation = useCreateUser();
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);

  return (
    <Modal
      open
      onClose={onClose}
      title="Create New User"
      description="Record takers can submit fuel entries but never amend them."
      footer={
        <>
          <PrimaryButton type="submit" form="create-user" disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Creating…" : "Create User"}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onClose} disabled={pending}>
            Cancel
          </SecondaryButton>
        </>
      }
    >
      <form
        id="create-user"
        className="space-y-4 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(new FormData(event.currentTarget), {
            onSuccess: (result) => {
              toast.success("User created", { description: result.message });
              onClose();
            },
          });
        }}
      >

        <Field label="Full name" htmlFor="u-name" required error={errors?.name}>
          <TextInput id="u-name" name="name" placeholder="Ama Boateng" required maxLength={120} autoComplete="off" disabled={pending} />
        </Field>

        <Field label="Email address" htmlFor="u-email" required error={errors?.email}>
          <TextInput
            id="u-email"
            name="email"
            type="email"
            placeholder="ama.boateng@company.com"
            required
            autoComplete="off"
            disabled={pending}
          />
        </Field>

        <RoleAndSiteFields role={role} onRoleChange={setRole} errors={errors} disabled={pending} idPrefix="u" />

        <div className="rounded-xl bg-slate-50 p-3.5">
          <p className="text-sm text-slate-600">
            Set a temporary password to let them sign in straight away. Leave both empty to create an invited account
            and set the password later from the ⋯ menu.
          </p>
          <div className="mt-3">
            <FieldRow>
              <Field label="Temporary password" htmlFor="u-password" hint="At least 8 characters" error={errors?.password}>
                <TextInput id="u-password" name="password" type="password" minLength={8} autoComplete="new-password" disabled={pending} />
              </Field>
              <Field label="Confirm password" htmlFor="u-confirm" error={errors?.confirmPassword}>
                <TextInput id="u-confirm" name="confirmPassword" type="password" autoComplete="new-password" disabled={pending} />
              </Field>
            </FieldRow>
          </div>
        </div>
      </form>
    </Modal>
  );
}
