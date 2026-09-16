"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Field, FieldRow, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { useCreateOperator, useUpdateOperator } from "@/queries/setupMutations";
import { sitesQuery } from "@/queries/siteQueries";
import { allOperatorsQuery } from "@/queries/setupQueries";
import { fieldErrors } from "@/queries/useActionMutation";
import { accountsQuery } from "@/queries/userQueries";
import type { OperatorRow } from "@/types/operator";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Omit to add an operator; pass a row to edit them. */
  operator?: OperatorRow;
};

export default function OperatorFormModal({ open, ...props }: Props) {
  // Mount only while open, so each opening starts with fresh state.
  if (!open) return null;
  return <OperatorForm {...props} />;
}

function OperatorForm({ onClose, operator }: Omit<Props, "open">) {
  const editing = Boolean(operator);
  const formId = editing ? `edit-operator-${operator!.id}` : "add-operator";

  const sites = useQuery(sitesQuery());
  const accounts = useQuery(accountsQuery());
  const operators = useQuery(allOperatorsQuery());

  const createOperator = useCreateOperator();
  const updateOperator = useUpdateOperator();
  const mutation = editing ? updateOperator : createOperator;
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);

  // Each account can be linked to at most one operator.
  const takenUserIds = new Set(
    (operators.data ?? []).filter((o) => o.userId && o.id !== operator?.id).map((o) => o.userId as string)
  );
  const linkable = (accounts.data ?? []).filter((a) => !takenUserIds.has(a.id));

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${operator!.name}` : "Add operator"}
      description="Drivers and plant operators are who a fill is recorded against. They don't need a portal account."
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : editing ? "Save changes" : "Add operator"}
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
              toast.success(editing ? `${operator!.name} updated` : "Operator added", { description: result.message });
              onClose();
            },
          });
        }}
      >
        {editing && (
          <>
            <input type="hidden" name="id" value={operator!.id} />
            {/* Lets the action tell a changed link from an unchanged one. */}
            <input type="hidden" name="currentUserId" value={operator!.userId ?? ""} />
          </>
        )}

        <FieldRow>
          <Field label="Full name" htmlFor="op-name" required error={errors?.name}>
            <TextInput id="op-name" name="name" placeholder="Yaw Mensah" defaultValue={operator?.name} required maxLength={120} disabled={pending} />
          </Field>
          <Field label="Phone" htmlFor="op-phone" hint="Optional" error={errors?.phone}>
            <TextInput id="op-phone" name="phone" type="tel" placeholder="024 000 0000" defaultValue={operator?.phone ?? ""} maxLength={30} disabled={pending} />
          </Field>
        </FieldRow>

        <Field
          label="Site"
          htmlFor="op-site"
          hint={
            sites.isError
              ? `Couldn't load sites: ${sites.error.message}`
              : "Leave as All sites for someone who works anywhere"
          }
          error={errors?.siteId}
        >
          <SelectInput id="op-site" name="siteId" defaultValue={operator?.siteId ?? ""} disabled={pending || sites.isPending}>
            <option value="">All sites</option>
            {sites.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field
          label="Portal account"
          htmlFor="op-user"
          hint="Optional — link them if they also sign in to record fills"
          error={errors?.userId}
        >
          <SelectInput id="op-user" name="userId" defaultValue={operator?.userId ?? ""} disabled={pending || accounts.isPending}>
            <option value="">Not linked</option>
            {linkable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.roleLabel}
              </option>
            ))}
          </SelectInput>
        </Field>

        {accounts.isSuccess && linkable.length === 0 && (
          <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
            Every account is already linked to an operator. Create one on{" "}
            <Link href="/portal/users_and_roles" className="font-medium underline" onClick={onClose}>
              Users &amp; Roles
            </Link>{" "}
            if this person needs to sign in.
          </p>
        )}
      </form>
    </Modal>
  );
}
