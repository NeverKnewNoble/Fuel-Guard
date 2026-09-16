"use client";

import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Field, FieldRow, PrimaryButton, SecondaryButton, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { useCreateSite, useUpdateSite } from "@/queries/setupMutations";
import { fieldErrors } from "@/queries/useActionMutation";
import type { SiteUsageRow } from "@/types/site";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Omit to add a site; pass a row to edit it. */
  site?: SiteUsageRow;
};

export default function SiteFormModal({ open, ...props }: Props) {
  // Mount only while open, so each opening starts with fresh state.
  if (!open) return null;
  return <SiteForm {...props} />;
}

function SiteForm({ onClose, site }: Omit<Props, "open">) {
  const editing = Boolean(site);
  const formId = editing ? `edit-site-${site!.id}` : "add-site";

  const createSite = useCreateSite();
  const updateSite = useUpdateSite();
  const mutation = editing ? updateSite : createSite;
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${site!.code}` : "Add site"}
      description={
        editing
          ? "The site code can't change once records point at it."
          : "A place work happens: equipment, tankers and records takers are all assigned to one."
      }
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : editing ? "Save changes" : "Add site"}
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
              toast.success(editing ? `${site!.code} updated` : "Site added", { description: result.message });
              onClose();
            },
          });
        }}
      >
        {editing && <input type="hidden" name="id" value={site!.id} />}

        <FieldRow>
          <Field
            label="Site code"
            htmlFor="site-code"
            required={!editing}
            hint={editing ? undefined : "Short and unique, e.g. SITE-A"}
            error={errors?.code}
          >
            <TextInput
              id="site-code"
              name="code"
              placeholder="SITE-D"
              defaultValue={site?.code}
              required={!editing}
              readOnly={editing}
              maxLength={30}
              disabled={pending}
            />
          </Field>
          <Field label="Region" htmlFor="site-region" hint="Optional" error={errors?.region}>
            <TextInput id="site-region" name="region" placeholder="Ashanti" defaultValue={site?.region ?? ""} maxLength={80} disabled={pending} />
          </Field>
        </FieldRow>

        <Field label="Site name" htmlFor="site-name" required error={errors?.name}>
          <TextInput
            id="site-name"
            name="name"
            placeholder="Site D – Takoradi"
            defaultValue={site?.name}
            required
            maxLength={120}
            disabled={pending}
          />
        </Field>
      </form>
    </Modal>
  );
}
