"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { useCreateEquipmentType, useUpdateStandard } from "@/queries/standardsMutations";
import { fieldErrors } from "@/queries/useActionMutation";
import type { Basis, EquipmentTypeRow } from "@/types/standards";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Omit to add a new type; pass a row to edit its standard. */
  type?: EquipmentTypeRow;
};

export default function EquipmentTypeModal({ open, ...props }: Props) {
  // Mount the form only while open, so each opening starts with fresh state.
  if (!open) return null;
  return <EquipmentTypeForm {...props} />;
}

function EquipmentTypeForm({ onClose, type }: Omit<Props, "open">) {
  const editing = Boolean(type);
  const formId = editing ? `edit-type-${type!.id}` : "add-equipment-type";
  const [basis, setBasis] = useState<Basis>(type?.basis ?? "hours");

  const createType = useCreateEquipmentType();
  const updateStandard = useUpdateStandard();
  const mutation = editing ? updateStandard : createType;
  const pending = mutation.isPending;

  const errors = fieldErrors(mutation.error);
  const standardError = errors?.lKmStandard ?? errors?.lHrStandard;
  const current = basis === "km" ? type?.lKmStandard : type?.lHrStandard;
  const basisChanged = editing && basis !== type!.basis;

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${type!.name} standard` : "Add equipment type"}
      description={
        editing
          ? "Applies to every unit of this type unless a unit has its own override."
          : "Set the consumption standard new units of this type start from."
      }
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : editing ? "Save standard" : "Add type"}
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
              toast.success(editing ? `${type!.name} updated` : "Equipment type added", { description: result.message });
              onClose();
            },
          });
        }}
      >
        {editing && <input type="hidden" name="id" value={type!.id} />}

        {!editing && (
          <Field label="Type name" htmlFor="type-name" required error={errors?.name}>
            <TextInput
              id="type-name"
              name="name"
              placeholder="Wheel Loader"
              required
              maxLength={80}
              disabled={pending}
              aria-invalid={Boolean(errors?.name) || undefined}
              aria-describedby={errors?.name ? "type-name-error" : undefined}
            />
          </Field>
        )}

        <Field
          label="Measured by"
          htmlFor="type-basis"
          required
          error={errors?.basis}
          hint={basisChanged && type!.unitCount > 0 ? `This changes how all ${type!.unitCount} units of this type are measured.` : undefined}
        >
          <SelectInput
            id="type-basis"
            name="basis"
            value={basis}
            onChange={(e) => setBasis(e.target.value as Basis)}
            disabled={pending}
          >
            <option value="hours">Hour meter (hrs) — L/hr</option>
            <option value="km">Odometer (km) — L/km</option>
          </SelectInput>
        </Field>

        <Field
          label={basis === "km" ? "L/km standard" : "L/hr standard"}
          htmlFor="type-standard"
          required
          error={standardError}
          hint={basis === "km" ? "Litres per kilometre, e.g. 0.380" : "Litres per engine hour, e.g. 12.5"}
        >
          {/* Keyed by basis so switching clears the value typed for the other unit. */}
          <TextInput
            key={basis}
            id="type-standard"
            name="standard"
            type="number"
            inputMode="decimal"
            min={basis === "km" ? "0.001" : "0.01"}
            step={basis === "km" ? "0.001" : "0.01"}
            placeholder={basis === "km" ? "0.380" : "12.50"}
            required
            defaultValue={current ?? undefined}
            disabled={pending}
            aria-invalid={Boolean(standardError) || undefined}
            aria-describedby={standardError ? "type-standard-error" : undefined}
          />
        </Field>

        {editing && (
          <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
            Alerts that were already raised aren&apos;t recalculated. Only new fuel entries use the new standard.
          </p>
        )}
      </form>
    </Modal>
  );
}
