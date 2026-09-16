"use client";

import { Archive, CircleCheck, CircleSlash, MapPin, Pencil, RotateCcw, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/modals/confirmDialog";
import EquipmentFormModal from "@/components/modals/equipmentFormModal";
import MoveEquipmentModal from "@/components/modals/moveEquipmentModal";
import RowActions from "@/components/ui/rowActions";
import { useSetEquipmentStatus } from "@/queries/equipmentMutations";
import type { EquipmentRecordStatus, EquipmentRow } from "@/types/equipment";
import { equipmentStatusStyles } from "@/utils/statusUtils";

/** ⋯ menu on a registry row: edit, move, change status, retire. */
export function EquipmentRowActions({ unit }: { unit: EquipmentRow }) {
  const [dialog, setDialog] = useState<"edit" | "move" | "retire" | null>(null);
  const setStatus = useSetEquipmentStatus();
  const close = () => {
    setDialog(null);
    setStatus.reset();
  };

  function changeStatus(status: EquipmentRecordStatus) {
    setStatus.mutate(
      { id: unit.id, status },
      {
        onSuccess: (result) => {
          toast.success(`${unit.code} is now ${equipmentStatusStyles[status].label.toLowerCase()}`, { description: result.message });
          setDialog(null);
        },
      }
    );
  }

  const retired = unit.status === "retired";

  return (
    <>
      <RowActions
        label={`${unit.code} ${unit.makeModel}`}
        items={[
          { label: "Edit", icon: Pencil, onSelect: () => setDialog("edit") },
          { label: "Move to site", icon: MapPin, onSelect: () => setDialog("move"), hidden: retired },
          { label: "Mark active", icon: CircleCheck, onSelect: () => changeStatus("active"), hidden: retired || unit.status === "active", separated: true },
          { label: "Mark maintenance", icon: Wrench, onSelect: () => changeStatus("maintenance"), hidden: retired || unit.status === "maintenance" },
          { label: "Mark idle", icon: CircleSlash, onSelect: () => changeStatus("idle"), hidden: retired || unit.status === "idle" },
          { label: "Retire", icon: Archive, onSelect: () => setDialog("retire"), hidden: retired, tone: "danger", separated: true },
          { label: "Reactivate", icon: RotateCcw, onSelect: () => changeStatus("active"), hidden: !retired, separated: true },
        ]}
      />
      <EquipmentFormModal open={dialog === "edit"} onClose={close} equipmentId={unit.id} />
      <MoveEquipmentModal open={dialog === "move"} onClose={close} unit={unit} />
      <ConfirmDialog
        open={dialog === "retire"}
        onClose={close}
        onConfirm={() => changeStatus("retired")}
        title={`Retire ${unit.code}?`}
        description={`${unit.typeName} · ${unit.makeModel} at ${unit.siteName}.`}
        confirmLabel="Retire unit"
        pendingLabel="Retiring…"
        pending={setStatus.isPending}
      >
        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          Its fuel history stays, but it no longer appears in fuel entry forms or the monthly summary. You can reactivate it later.
        </p>
      </ConfirmDialog>
    </>
  );
}
