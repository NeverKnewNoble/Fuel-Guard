"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field, FieldRow, FormError, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { useRecordTransfer } from "@/queries/tankMutations";
import { tankOptionsQuery } from "@/queries/tankQueries";
import { fieldErrors } from "@/queries/useActionMutation";
import { dateTimeInputValues } from "@/utils/formatDate";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Pre-selects the tank the fuel comes out of, e.g. when opened from a tank's ⋯ menu. */
  fromTankId?: string;
};

export default function TransferFuelModal({ open, ...props }: Props) {
  // Mount only while open, so each opening starts with fresh state and the current time.
  if (!open) return null;
  return <TransferFuelForm {...props} />;
}

function TransferFuelForm({ onClose, fromTankId }: Omit<Props, "open">) {
  const formId = "transfer-fuel";
  const tanks = useQuery(tankOptionsQuery());
  const [fromId, setFromId] = useState(fromTankId ?? "");
  const [toId, setToId] = useState("");
  const [when] = useState(() => dateTimeInputValues());

  const mutation = useRecordTransfer();
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);
  const tooFewTanks = tanks.isSuccess && tanks.data.length < 2;

  const from = tanks.data?.find((t) => t.id === fromId);
  const to = tanks.data?.find((t) => t.id === toId);
  // The most that can move: what the source holds, capped by the room left in the destination.
  const maxL = from && to ? Math.max(0, Math.min(from.currentL, to.capacityL - to.currentL)) : from ? Math.max(0, from.currentL) : undefined;

  const label = (t: { name: string; siteName: string; currentL: number; capacityL: number }) =>
    `${t.name} — ${t.siteName} (${t.currentL.toLocaleString()} / ${t.capacityL.toLocaleString()} L)`;

  return (
    <Modal
      open
      onClose={onClose}
      title="Transfer Fuel"
      description="Moves fuel from one tank into another. Both levels and the month's reconciliation follow it."
      size="lg"
      footer={
        <>
          <PrimaryButton type="submit" form={formId} disabled={pending || tooFewTanks || tanks.isPending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : "Save Transfer"}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onClose} disabled={pending}>
            Cancel
          </SecondaryButton>
        </>
      }
    >
      {tooFewTanks ? (
        <p className="mb-4 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-800">You need at least two tanks to transfer fuel between them.</p>
      ) : (
        <form
          id={formId}
          className="space-y-4 pb-2"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(new FormData(event.currentTarget), {
              onSuccess: (result) => {
                toast.success("Transfer recorded", { description: result.message });
                onClose();
              },
            });
          }}
        >
          {tanks.isError && <FormError message={`Couldn't load tanks (${tanks.error.message}).`} />}

          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <Field label="From tank" htmlFor="tr-from" required error={errors?.fromTankId}>
              <SelectInput
                id="tr-from"
                name="fromTankId"
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                required
                disabled={pending || tanks.isPending}
              >
                <option value="" disabled>
                  {tanks.isPending ? "Loading tanks…" : "Select tank…"}
                </option>
                {tanks.data?.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.id === toId}>
                    {label(t)}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <button
              type="button"
              onClick={() => {
                setFromId(toId);
                setToId(fromId);
              }}
              disabled={pending || (!fromId && !toId)}
              className="mx-auto mb-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-50"
              aria-label="Swap the from and to tanks"
              title="Swap"
            >
              <ArrowLeftRight className="h-4 w-4 rotate-90 sm:rotate-0" aria-hidden />
            </button>
            <Field label="To tank" htmlFor="tr-to" required error={errors?.toTankId}>
              <SelectInput
                id="tr-to"
                name="toTankId"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                required
                disabled={pending || tanks.isPending}
              >
                <option value="" disabled>
                  {tanks.isPending ? "Loading tanks…" : "Select tank…"}
                </option>
                {tanks.data?.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.id === fromId}>
                    {label(t)}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>

          <Field
            label="Quantity (L)"
            htmlFor="tr-litres"
            required
            hint={maxL !== undefined ? `Up to ${maxL.toLocaleString()} L can move` : "Must be in the source tank and fit in the destination"}
            error={errors?.litres}
          >
            <TextInput
              id="tr-litres"
              name="litres"
              type="number"
              inputMode="decimal"
              min="0.01"
              max={maxL || undefined}
              step="0.01"
              placeholder="0"
              required
              disabled={pending}
            />
          </Field>

          <FieldRow>
            <Field label="Date" htmlFor="tr-date" required error={errors?.transferredAt}>
              <TextInput id="tr-date" name="date" type="date" defaultValue={when.date} max={when.date} required disabled={pending} />
            </Field>
            <Field label="Time" htmlFor="tr-time" required hint="Accra time">
              <TextInput id="tr-time" name="time" type="time" defaultValue={when.time} required disabled={pending} />
            </Field>
          </FieldRow>

          <Field label="Note" htmlFor="tr-note" error={errors?.note}>
            <TextInput id="tr-note" name="note" placeholder="Topping up the day tank" maxLength={200} disabled={pending} />
          </Field>
        </form>
      )}
    </Modal>
  );
}
