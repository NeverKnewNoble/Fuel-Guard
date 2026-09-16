"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { useMoveEquipment } from "@/queries/equipmentMutations";
import { sitesQuery } from "@/queries/siteQueries";
import { fieldErrors } from "@/queries/useActionMutation";
import type { EquipmentRow } from "@/types/equipment";

type Props = { open: boolean; onClose: () => void; unit: EquipmentRow };

export default function MoveEquipmentModal({ open, ...props }: Props) {
  if (!open) return null;
  return <MoveForm {...props} />;
}

function MoveForm({ onClose, unit }: Omit<Props, "open">) {
  const sites = useQuery(sitesQuery());
  const mutation = useMoveEquipment();
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);
  const otherSites = sites.data?.filter((s) => s.id !== unit.siteId) ?? [];
  const formId = `move-equipment-${unit.id}`;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Move ${unit.code}`}
      description={`Currently at ${unit.siteName}. Past fuel entries keep the site they were recorded at.`}
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending || otherSites.length === 0}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Moving…" : "Move unit"}
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
              toast.success(`${unit.code} moved`, { description: result.message });
              onClose();
            },
          });
        }}
      >
        {sites.isError && <FormError message={`Couldn't load sites: ${sites.error.message}`} />}
        <input type="hidden" name="id" value={unit.id} />

        {sites.isSuccess && otherSites.length === 0 ? (
          <p className="rounded-xl bg-amber-50 p-3.5 text-sm text-amber-800">There&apos;s no other active site to move it to.</p>
        ) : (
          <Field label="New site" htmlFor="move-site" required error={errors?.siteId}>
            <SelectInput id="move-site" name="siteId" defaultValue="" required disabled={pending || sites.isPending}>
              <option value="" disabled>
                {sites.isPending ? "Loading sites…" : "Select site…"}
              </option>
              {otherSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        )}
      </form>
    </Modal>
  );
}
