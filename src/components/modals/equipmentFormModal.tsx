"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Field, FieldRow, FormError, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import ErrorState from "@/components/ui/errorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateEquipment, useUpdateEquipment } from "@/queries/equipmentMutations";
import { equipmentDetailQuery } from "@/queries/equipmentQueries";
import { sitesQuery } from "@/queries/siteQueries";
import { equipmentTypesQuery } from "@/queries/standardsQueries";
import { fieldErrors } from "@/queries/useActionMutation";
import type { EquipmentDetail } from "@/types/equipment";
import type { EquipmentTypeRow } from "@/types/standards";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Omit to add a unit; pass an id to edit that unit. */
  equipmentId?: string;
};

export default function EquipmentFormModal({ open, ...props }: Props) {
  // Mount only while open, so each opening starts with fresh state.
  if (!open) return null;
  return props.equipmentId ? <EditLoader {...props} equipmentId={props.equipmentId} /> : <EquipmentForm onClose={props.onClose} />;
}

/** Edit needs fields the registry row doesn't have (registration, capacity, overrides), so load the unit first. */
function EditLoader({ onClose, equipmentId }: { onClose: () => void; equipmentId: string }) {
  const detail = useQuery(equipmentDetailQuery(equipmentId));

  if (detail.isSuccess) return <EquipmentForm onClose={onClose} unit={detail.data} />;

  return (
    <Modal open onClose={onClose} title="Edit equipment">
      {detail.isError ? (
        <ErrorState size="sm" what="this unit" message={detail.error.message} onRetry={() => detail.refetch()} retrying={detail.isFetching} />
      ) : (
        <div role="status" className="space-y-5 pb-4">
          <span className="sr-only">Loading unit…</span>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function EquipmentForm({ onClose, unit }: { onClose: () => void; unit?: EquipmentDetail }) {
  const editing = Boolean(unit);
  const formId = editing ? `edit-equipment-${unit!.id}` : "add-equipment";

  const types = useQuery(equipmentTypesQuery());
  const sites = useQuery(sitesQuery());
  const [typeId, setTypeId] = useState(unit?.equipmentTypeId ?? "");
  const type: EquipmentTypeRow | undefined = types.data?.find((t) => t.id === typeId);

  const createEquipment = useCreateEquipment();
  const updateEquipment = useUpdateEquipment();
  const mutation = editing ? updateEquipment : createEquipment;
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);

  const optionsLoading = types.isPending || (!editing && sites.isPending);
  const noTypes = types.isSuccess && types.data.length === 0;
  const noSites = !editing && sites.isSuccess && sites.data.length === 0;

  // The override field matches the type's basis; switching type starts it empty (the new type's default).
  const km = type?.basis === "km";
  const overrideName = km ? "lKmStandardOverride" : "lHrStandardOverride";
  const overrideError = errors?.lKmStandardOverride ?? errors?.lHrStandardOverride;
  const typeDefault = km ? type?.lKmStandard : type?.lHrStandard;
  const currentOverride =
    unit && typeId === unit.equipmentTypeId ? (km ? unit.lKmStandardOverride : unit.lHrStandardOverride) : null;

  const blocked = noTypes || noSites;

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${unit!.code}` : "Add Equipment"}
      description={editing ? `${unit!.type.name} at ${unit!.site.name}. Use Move to site to change where it's based.` : undefined}
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending || blocked || optionsLoading}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : editing ? "Save changes" : "Add Equipment"}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onClose} disabled={pending}>
            Cancel
          </SecondaryButton>
        </>
      }
    >
      {blocked ? (
        <p className="mb-4 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-800">
          {noTypes ? (
            <>
              Add an equipment type on{" "}
              <Link href="/portal/consumption_standards" className="font-medium underline" onClick={onClose}>
                Consumption Standards
              </Link>{" "}
              first. Every unit needs one for its standard.
            </>
          ) : (
            <>
              No active site to assign the unit to. Add one on{" "}
              <Link href="/portal/sites" className="font-medium underline" onClick={onClose}>
                Sites
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <form
          id={formId}
          className="space-y-4 pb-2"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(new FormData(event.currentTarget), {
              onSuccess: (result) => {
                toast.success(editing ? `${unit!.code} updated` : "Equipment added", { description: result.message });
                onClose();
              },
            });
          }}
        >
          {types.isError && <FormError message={`Couldn't load equipment types: ${types.error.message}`} />}
          {!editing && sites.isError && <FormError message={`Couldn't load sites: ${sites.error.message}`} />}
          {editing && <input type="hidden" name="id" value={unit!.id} />}

          <FieldRow>
            <Field label="Equipment ID" htmlFor="eq-code" hint={editing ? undefined : "Leave empty to number it automatically"} error={errors?.code}>
              <TextInput
                id="eq-code"
                name="code"
                placeholder="EQ-011"
                defaultValue={unit?.code}
                required={editing}
                maxLength={30}
                disabled={pending}
              />
            </Field>
            <Field label="Registration no." htmlFor="eq-reg" hint="Road vehicles" error={errors?.registrationNo}>
              <TextInput id="eq-reg" name="registrationNo" placeholder="GR 1234-24" defaultValue={unit?.registrationNo ?? ""} maxLength={30} disabled={pending} />
            </Field>
          </FieldRow>

          <Field label="Type" htmlFor="eq-type" required error={errors?.equipmentTypeId}>
            <SelectInput
              id="eq-type"
              name="equipmentTypeId"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              required
              disabled={pending || optionsLoading}
              aria-invalid={Boolean(errors?.equipmentTypeId) || undefined}
            >
              <option value="" disabled>
                {types.isPending ? "Loading types…" : "Select type…"}
              </option>
              {types.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.basis === "km" ? "odometer" : "hour meter"}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Make / model" htmlFor="eq-make" required error={errors?.makeModel}>
            <TextInput
              id="eq-make"
              name="makeModel"
              placeholder="CAT 320"
              defaultValue={unit?.makeModel}
              required
              maxLength={80}
              disabled={pending}
              aria-invalid={Boolean(errors?.makeModel) || undefined}
            />
          </Field>

          {!editing && (
            <Field label="Assigned site" htmlFor="eq-site" required error={errors?.siteId}>
              <SelectInput
                id="eq-site"
                name="siteId"
                defaultValue=""
                required
                disabled={pending || optionsLoading}
                aria-invalid={Boolean(errors?.siteId) || undefined}
              >
                <option value="" disabled>
                  {sites.isPending ? "Loading sites…" : "Select site…"}
                </option>
                {sites.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          )}

          <FieldRow>
            <Field label="Fuel tank capacity (L)" htmlFor="eq-capacity" hint="Refills above this raise a critical alert" error={errors?.fuelTankCapacityL}>
              <TextInput
                id="eq-capacity"
                name="fuelTankCapacityL"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="400"
                defaultValue={unit?.fuelTankCapacityL ?? ""}
                disabled={pending}
              />
            </Field>
            <Field
              label={type ? (km ? "L/km standard" : "L/hr standard") : "Standard override"}
              htmlFor="eq-standard"
              hint={
                type
                  ? `Leave empty to use the ${type.name} default (${typeDefault ?? "—"} ${km ? "L/km" : "L/hr"})`
                  : "Pick a type first"
              }
              error={overrideError}
            >
              <TextInput
                key={typeId}
                id="eq-standard"
                name={overrideName}
                type="number"
                inputMode="decimal"
                min={km ? "0.001" : "0.01"}
                step={km ? "0.001" : "0.01"}
                placeholder={typeDefault !== undefined && typeDefault !== null ? String(typeDefault) : ""}
                defaultValue={currentOverride ?? ""}
                disabled={pending || !type}
              />
            </Field>
          </FieldRow>
        </form>
      )}
    </Modal>
  );
}
