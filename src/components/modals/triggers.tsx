"use client";

import { Pencil, Plus, UserPlus } from "lucide-react";
import { useState, type ReactNode } from "react";

import CreateUserModal from "@/components/modals/createUserModal";
import EditThresholdsModal from "@/components/modals/editThresholdsModal";
import EquipmentFormModal from "@/components/modals/equipmentFormModal";
import EquipmentTypeModal from "@/components/modals/equipmentTypeModal";
import NewFuelEntryModal from "@/components/modals/newFuelEntryModal";
import RecordIntakeModal from "@/components/modals/recordIntakeModal";
import TankFormModal from "@/components/modals/tankFormModal";
import type { AlertThreshold } from "@/types/standards";

const primary =
  "inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 sm:w-auto";
const secondary =
  "inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 sm:w-auto";

/** Button + the modal it opens, so the surrounding page can stay a server component. */
function Trigger({
  label,
  icon,
  variant,
  render,
}: {
  label: string;
  icon: ReactNode;
  variant: "primary" | "secondary";
  render: (open: boolean, close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={variant === "primary" ? primary : secondary}
      >
        {icon}
        {label}
      </button>
      {render(open, () => setOpen(false))}
    </>
  );
}

export function AddEquipmentButton() {
  return (
    <Trigger
      label="Add Equipment"
      variant="primary"
      icon={<Plus className="h-4 w-4" aria-hidden />}
      render={(open, close) => <EquipmentFormModal open={open} onClose={close} />}
    />
  );
}

export function AddTankerButton() {
  return (
    <Trigger
      label="Add Tanker"
      variant="secondary"
      icon={<Plus className="h-4 w-4" aria-hidden />}
      render={(open, close) => <TankFormModal open={open} onClose={close} />}
    />
  );
}

/** `currentUserId` pre-selects "Received by". */
export function RecordIntakeButton({ currentUserId }: { currentUserId: string }) {
  return (
    <Trigger
      label="Record Intake"
      variant="primary"
      icon={<Plus className="h-4 w-4" aria-hidden />}
      render={(open, close) => <RecordIntakeModal open={open} onClose={close} currentUserId={currentUserId} />}
    />
  );
}

export function NewFuelEntryButton() {
  return (
    <Trigger
      label="New Fuel Entry"
      variant="primary"
      icon={<Plus className="h-4 w-4" aria-hidden />}
      render={(open, close) => <NewFuelEntryModal open={open} onClose={close} />}
    />
  );
}

export function NewFuelLogEntryButton() {
  return (
    <Trigger
      label="New Fuel Log Entry"
      variant="primary"
      icon={<Plus className="h-4 w-4" aria-hidden />}
      render={(open, close) => <NewFuelEntryModal open={open} onClose={close} />}
    />
  );
}

/** Compact button for a DataCard header. */
const cardAction =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2";

export function EditThresholdsButton({ thresholds }: { thresholds: AlertThreshold[] | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cardAction}>
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        {thresholds ? "Edit thresholds" : "Set thresholds"}
      </button>
      <EditThresholdsModal open={open} onClose={() => setOpen(false)} thresholds={thresholds} />
    </>
  );
}

export function AddEquipmentTypeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cardAction}>
        <Plus className="h-4 w-4" aria-hidden />
        Add type
      </button>
      <EquipmentTypeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function CreateUserButton() {
  return (
    <Trigger
      label="Create New User"
      variant="primary"
      icon={<UserPlus className="h-4 w-4" aria-hidden />}
      render={(open, close) => <CreateUserModal open={open} onClose={close} />}
    />
  );
}
