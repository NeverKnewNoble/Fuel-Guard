"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  DerivedValue,
  Field,
  FieldRow,
    PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextInput,
} from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { useCreateFuelEntry } from "@/queries/fuelEntryMutations";
import { equipmentOptionsQuery, operatorsQuery } from "@/queries/fuelEntryQueries";
import { sitesQuery } from "@/queries/siteQueries";
import { tankOptionsQuery } from "@/queries/tankQueries";
import { fieldErrors } from "@/queries/useActionMutation";
import { meQuery } from "@/queries/userQueries";
import { dateTimeInputValues } from "@/utils/formatDate";

type Props = { open: boolean; onClose: () => void };

export default function NewFuelEntryModal({ open, onClose }: Props) {
  // Mount only while open, so each opening starts blank and with the current time.
  if (!open) return null;
  return <NewFuelEntryForm onClose={onClose} />;
}

function NewFuelEntryForm({ onClose }: { onClose: () => void }) {
  const equipment = useQuery(equipmentOptionsQuery());
  const tanks = useQuery(tankOptionsQuery());
  const operators = useQuery(operatorsQuery());
  const me = useQuery(meQuery());
  const sites = useQuery(sitesQuery());

  const formRef = useRef<HTMLFormElement>(null);
  const [now] = useState(() => dateTimeInputValues());
  const [equipmentId, setEquipmentId] = useState("");
  const [litres, setLitres] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const mutation = useCreateFuelEntry();
  const pending = mutation.isPending;
  const errors = fieldErrors(mutation.error);

  const unit = equipment.data?.find((e) => e.id === equipmentId);

  /**
   * The entry's site, the way the service records it: your own site if you have one,
   * otherwise (an administrator covering every site) the site the equipment is based at.
   */
  const siteName = me.data?.siteName ?? (unit ? (sites.data?.find((s) => s.id === unit.siteId)?.name ?? null) : null);

  const km = unit?.basis === "km";
  const meter = km
    ? { legend: "Odometer readings", unit: "km", startName: "odometerStart", endName: "odometerEnd", total: "Total km", rate: "L/km", dp: 3 }
    : { legend: "Hour-meter readings", unit: "hrs", startName: "hourMeterStart", endName: "hourMeterEnd", total: "Total hours", rate: "L/hr", dp: 1 };

  const usage = Math.max(0, (Number(end) || 0) - (Number(start) || 0));
  const quantity = Number(litres) || 0;
  const meterError = errors?.[meter.startName] ?? errors?.[meter.endName];

  const noEquipment = equipment.isSuccess && equipment.data.length === 0;
  const noTanks = tanks.isSuccess && tanks.data.length === 0;
  const noOperators = operators.isSuccess && operators.data.length === 0;
  const blocked = noEquipment || noTanks || noOperators;

  function clearForNextEntry() {
    setLitres("");
    setStart("");
    setEnd("");
    formRef.current?.querySelector<HTMLInputElement>("#fe-litres")?.focus();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New Fuel Log Entry"
      description="Records the fuel an equipment draws from a tanker. Submitted entries can only be changed by requesting a correction."
      size="lg"
      footer={
        <>
          <PrimaryButton type="submit" form="new-fuel-entry" disabled={pending || blocked}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : "Save Entry"}
          </PrimaryButton>
          <SecondaryButton type="submit" form="new-fuel-entry" data-mode="another" disabled={pending || blocked}>
            Save &amp; Add Another
          </SecondaryButton>
        </>
      }
    >
      {blocked ? (
        <p className="mb-4 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-800">
          {noEquipment ? (
            <>
              No equipment is available to draw fuel. Register a unit on{" "}
              <Link href="/portal/equipment_and_vehicles" className="font-medium underline" onClick={onClose}>
                Equipment &amp; Vehicles
              </Link>
              , or check it isn&apos;t in maintenance or retired.
            </>
          ) : noTanks ? (
            <>
              No tanker is available to draw from. Add one on{" "}
              <Link href="/portal/tankers" className="font-medium underline" onClick={onClose}>
                Tankers
              </Link>
              .
            </>
          ) : (
            <>
              Nobody to record the fill against yet. Add a driver or operator on{" "}
              <Link href="/portal/operators" className="font-medium underline" onClick={onClose}>
                Drivers &amp; Operators
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <form
          ref={formRef}
          id="new-fuel-entry"
          className="space-y-4 pb-2"
          onSubmit={(event) => {
            event.preventDefault();
            const again = (event.nativeEvent as SubmitEvent).submitter?.dataset.mode === "another";
            mutation.mutate(new FormData(event.currentTarget), {
              onSuccess: (result) => {
                toast.success("Entry saved", { description: result.message });
                if (again) clearForNextEntry();
                else onClose();
              },
            });
          }}
        >

          <FieldRow>
            <Field label="Date" htmlFor="fe-date" required error={errors?.dispensedAt}>
              <TextInput id="fe-date" name="date" type="date" defaultValue={now.date} max={now.date} required disabled={pending} />
            </Field>
            <Field label="Time" htmlFor="fe-time" required hint="Accra time">
              <TextInput id="fe-time" name="time" type="time" defaultValue={now.time} required disabled={pending} />
            </Field>
          </FieldRow>

          <Field label="Equipment no / ID" htmlFor="fe-eq" required error={errors?.equipmentId}>
            <SelectInput
              id="fe-eq"
              name="equipmentId"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              required
              disabled={pending || equipment.isPending}
            >
              <option value="" disabled>
                {equipment.isPending ? "Loading equipment…" : "Select equipment…"}
              </option>
              {equipment.data?.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.label}
                </option>
              ))}
            </SelectInput>
          </Field>

          <FieldRow>
            <DerivedValue label="Equipment type" value={unit ? `${unit.typeName} · ${km ? "odometer" : "hour meter"}` : "Select equipment first"} />
            <Field label="Drawn from tanker" htmlFor="fe-tank" required error={errors?.tankId}>
              <SelectInput id="fe-tank" name="tankId" defaultValue="" required disabled={pending || tanks.isPending}>
                <option value="" disabled>
                  {tanks.isPending ? "Loading tankers…" : "Select tanker…"}
                </option>
                {tanks.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.currentL.toLocaleString()} L)
                  </option>
                ))}
              </SelectInput>
            </Field>
          </FieldRow>

          <Field label="Driver / operator" htmlFor="fe-driver" required error={errors?.operatorId}>
            <SelectInput id="fe-driver" name="operatorId" defaultValue="" required disabled={pending || operators.isPending}>
              <option value="" disabled>
                {operators.isPending ? "Loading operators…" : "Select driver…"}
              </option>
              {operators.data?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.siteName ? ` — ${o.siteName}` : ""}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Qty of fuel issued (L)" htmlFor="fe-litres" required error={errors?.litres}>
            <TextInput
              id="fe-litres"
              name="litres"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={litres}
              onChange={(e) => setLitres(e.target.value)}
              required
              disabled={pending}
            />
          </Field>

          {/* Only the meter the equipment type is measured by — the other would be rejected. */}
          <fieldset className="rounded-xl border border-slate-200 p-4" disabled={pending || !unit}>
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              {unit ? meter.legend : "Meter readings"}
            </legend>
            <FieldRow>
              <Field label="Start" htmlFor="fe-meter-start" required={Boolean(unit)} error={errors?.[meter.startName]}>
                <TextInput
                  key={`${meter.startName}-start`}
                  id="fe-meter-start"
                  name={meter.startName}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  placeholder={unit ? meter.unit : "Select equipment first"}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required={Boolean(unit)}
                />
              </Field>
              <Field label="End" htmlFor="fe-meter-end" required={Boolean(unit)} error={errors?.[meter.endName]}>
                <TextInput
                  key={`${meter.endName}-end`}
                  id="fe-meter-end"
                  name={meter.endName}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  placeholder={unit ? meter.unit : ""}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required={Boolean(unit)}
                />
              </Field>
            </FieldRow>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DerivedValue label={meter.total} value={usage ? usage.toLocaleString() : "—"} />
              <DerivedValue label={meter.rate} value={usage > 0 && quantity > 0 ? (quantity / usage).toFixed(meter.dp) : "—"} />
            </div>
            {meterError && <p className="mt-2 text-xs font-medium text-brand-700">{meterError}</p>}
          </fieldset>

          <FieldRow>
            {/* Filled in for you: the service records the site itself, so it can't be mistyped. */}
            <DerivedValue
              label="Site"
              value={siteName ?? (me.isPending ? "Loading…" : "Follows the equipment")}
            />
            <Field
              label="Activity"
              htmlFor="fe-loc"
              required
              hint="Where on site, and what it was doing"
              error={errors?.locationActivity}
            >
              <TextInput
                id="fe-loc"
                name="locationActivity"
                placeholder="Main Pit — grading"
                required
                maxLength={200}
                disabled={pending}
              />
            </Field>
          </FieldRow>
        </form>
      )}
    </Modal>
  );
}
