"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PrimaryButton, SecondaryButton } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { RoleAndSiteFields } from "@/components/users/roleAndSiteFields";
import { useChangeUserRole } from "@/queries/userMutations";
import { fieldErrors } from "@/queries/useActionMutation";
import type { AccountRow } from "@/types/account";
import type { AppUserRole } from "@/types/next-auth";

type Props = { open: boolean; onClose: () => void; account: AccountRow };

export default function ChangeRoleModal({ open, ...props }: Props) {
  if (!open) return null;
  return <ChangeRoleForm {...props} />;
}

function ChangeRoleForm({ onClose, account }: Omit<Props, "open">) {
  const [role, setRole] = useState<AppUserRole>(account.role);
  const mutation = useChangeUserRole();
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);
  const formId = `change-role-${account.id}`;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Change role for ${account.name}`}
      description={`Currently ${account.roleLabel} · ${account.siteName}.`}
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : "Save role"}
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
              toast.success(`${account.name}'s role updated`, { description: result.message });
              onClose();
            },
          });
        }}
      >
        <input type="hidden" name="id" value={account.id} />

        <RoleAndSiteFields
          role={role}
          onRoleChange={setRole}
          defaultSiteId={account.siteId}
          errors={errors}
          disabled={pending}
          idPrefix="cr"
        />

        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          If they&apos;re signed in, they keep their current access until they sign out and back in.
        </p>
      </form>
    </Modal>
  );
}
