"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DerivedValue, Field, FieldRow, FormError, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { useRecordIntake, useUpdateIntake } from "@/queries/tankMutations";
import { suppliersQuery, tankOptionsQuery } from "@/queries/tankQueries";
import { fieldErrors } from "@/queries/useActionMutation";
import { accountsQuery } from "@/queries/userQueries";
import type { IntakeRow } from "@/types/tank";
import { dateTimeInputValues } from "@/utils/formatDate";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Pre-selects "Received by" when recording a new delivery. */
  currentUserId?: string;
  /** Pass a delivery to correct it instead. Its tanker can't change. */
  intake?: IntakeRow;
};

export default function RecordIntakeModal({ open, ...props }: Props) {
  // Mount only while open, so each opening starts with fresh state and the current time.
  if (!open) return null;
  return <RecordIntakeForm {...props} />;
}

function RecordIntakeForm({ onClose, currentUserId, intake }: Omit<Props, "open">) {
  const editing = Boolean(intake);
  const formId = editing ? `edit-intake-${intake!.id}` : "record-intake";

  const tanks = useQuery(tankOptionsQuery());
  const suppliers = useQuery(suppliersQuery());
  const accounts = useQuery(accountsQuery());
  const receivers = accounts.data?.filter((a) => a.status === "active") ?? [];

  const [when] = useState(() => dateTimeInputValues(intake?.receivedAt));
  const [today] = useState(() => dateTimeInputValues().date);

  const recordIntake = useRecordIntake();
  const updateIntake = useUpdateIntake();
  const mutation = editing ? updateIntake : recordIntake;
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);
  const noTanks = !editing && tanks.isSuccess && tanks.data.length === 0;

  const loadError = [
    tanks.isError && `tankers (${tanks.error.message})`,
    accounts.isError && `users (${accounts.error.message})`,
  ].filter(Boolean);

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${intake!.code}` : "Record Intake"}
      description={
        editing
          ? "Corrects a delivery that was mistyped. Stock levels, the reconciliation and fuel costs follow the new figures."
          : "Fuel received from a supplier into one of your tankers."
      }
      size="lg"
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending || noTanks || (!editing && tanks.isPending)}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : editing ? "Save changes" : "Save Intake"}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onClose} disabled={pending}>
            Cancel
          </SecondaryButton>
        </>
      }
    >
      {noTanks ? (
        <p className="mb-4 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-800">Add a tanker first, then record deliveries into it.</p>
      ) : (
        <form
          id={formId}
          className="space-y-4 pb-2"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(new FormData(event.currentTarget), {
              onSuccess: (result) => {
                toast.success(editing ? `${intake!.code} updated` : "Intake recorded", { description: result.message });
                onClose();
              },
            });
          }}
        >
          {loadError.length > 0 && <FormError message={`Couldn't load ${loadError.join(" or ")}.`} />}
          {editing && <input type="hidden" name="id" value={intake!.id} />}

          {editing ? (
            // Moving a delivery between tankers would rewrite two tanks' history; void it and record another instead.
            <DerivedValue label="Tanker" value={intake!.tankName} />
          ) : (
            <Field label="Tanker" htmlFor="in-tank" required error={errors?.tankId}>
              <SelectInput id="in-tank" name="tankId" defaultValue="" required disabled={pending || tanks.isPending}>
                <option value="" disabled>
                  {tanks.isPending ? "Loading tankers…" : "Select tanker…"}
                </option>
                {tanks.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.siteName} ({t.currentL.toLocaleString()} / {t.capacityL.toLocaleString()} L)
                  </option>
                ))}
              </SelectInput>
            </Field>
          )}

          <FieldRow>
            <Field label="Supplier" htmlFor="in-supplier" required hint="Pick a known supplier or type a new one" error={errors?.supplier}>
              <TextInput
                id="in-supplier"
                name="supplierName"
                list="in-supplier-options"
                placeholder="Goil Bulk Supply"
                defaultValue={intake?.supplier}
                required
                maxLength={120}
                autoComplete="off"
                disabled={pending}
              />
              <datalist id="in-supplier-options">
                {suppliers.data?.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Delivery note" htmlFor="in-dn" required error={errors?.deliveryNote}>
              <TextInput id="in-dn" name="deliveryNote" placeholder="DN-88231" defaultValue={intake?.deliveryNote} required maxLength={60} disabled={pending} />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Quantity received (L)" htmlFor="in-litres" required hint="Must fit in the tanker's free space" error={errors?.litres}>
              <TextInput
                id="in-litres"
                name="litres"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="0"
                defaultValue={intake?.litres}
                required
                disabled={pending}
              />
            </Field>
            <Field label="Cost per litre (GHS)" htmlFor="in-cost" required hint="Fuel entries use the latest price" error={errors?.costPerLitre}>
              <TextInput
                id="in-cost"
                name="costPerLitre"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.001"
                placeholder="3.420"
                defaultValue={intake?.costPerLitre}
                required
                disabled={pending}
              />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Date" htmlFor="in-date" required error={errors?.receivedAt}>
              <TextInput id="in-date" name="date" type="date" defaultValue={when.date} max={today} required disabled={pending} />
            </Field>
            <Field label="Time" htmlFor="in-time" required hint="Accra time">
              <TextInput id="in-time" name="time" type="time" defaultValue={when.time} required disabled={pending} />
            </Field>
          </FieldRow>

          <Field label="Received by" htmlFor="in-by" required error={errors?.receivedById}>
            <SelectInput
              id="in-by"
              name="receivedById"
              defaultValue={intake?.receivedById ?? currentUserId}
              required
              disabled={pending || accounts.isPending}
            >
              {accounts.isPending && <option value={intake?.receivedById ?? currentUserId}>Loading users…</option>}
              {receivers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.id === currentUserId ? " (you)" : ""} — {a.roleLabel}
                </option>
              ))}
            </SelectInput>
          </Field>
        </form>
      )}
    </Modal>
  );
}
