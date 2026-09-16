"use client";

import { Ban, Pencil, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/modals/confirmDialog";
import RecordIntakeModal from "@/components/modals/recordIntakeModal";
import VoidRecordModal from "@/components/modals/voidRecordModal";
import RowActions from "@/components/ui/rowActions";
import { useSetIntakeVoided } from "@/queries/tankMutations";
import type { IntakeRow } from "@/types/tank";

/** ⋯ menu on an intake row. Deliveries are voided, never deleted, so stock history stays intact. */
export function IntakeRowActions({ intake }: { intake: IntakeRow }) {
  const [dialog, setDialog] = useState<"edit" | "void" | "restore" | null>(null);
  const setVoided = useSetIntakeVoided();
  const close = () => {
    setDialog(null);
    setVoided.reset();
  };

  const voided = intake.voidedAt !== null;

  function submit(voidIt: boolean, reason = "") {
    const formData = new FormData();
    formData.set("id", intake.id);
    formData.set("voided", String(voidIt));
    formData.set("reason", reason);
    setVoided.mutate(formData, {
      onSuccess: (result) => {
        toast.success(voidIt ? `${intake.code} voided` : `${intake.code} restored`, { description: result.message });
        setDialog(null);
      },
    });
  }

  return (
    <>
      <RowActions
        label={`${intake.code} from ${intake.supplier}`}
        items={[
          { label: "Edit", icon: Pencil, onSelect: () => setDialog("edit"), hidden: voided },
          { label: "Void", icon: Ban, onSelect: () => setDialog("void"), hidden: voided, tone: "danger", separated: true },
          { label: "Restore", icon: Undo2, onSelect: () => setDialog("restore"), hidden: !voided },
        ]}
      />

      <RecordIntakeModal open={dialog === "edit"} onClose={close} intake={intake} />

      <VoidRecordModal
        open={dialog === "void"}
        onClose={close}
        onConfirm={(reason) => submit(true, reason)}
        title={`Void ${intake.code}?`}
        description={`${intake.litres.toLocaleString()} L into ${intake.tankName} from ${intake.supplier}.`}
        confirmLabel="Void delivery"
        pending={setVoided.isPending}
      >
        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          It stays in the intake log, marked void, but stops counting towards the tanker&apos;s level, the month&apos;s
          reconciliation and the price fuel is costed at. You can restore it later.
        </p>
      </VoidRecordModal>

      <ConfirmDialog
        open={dialog === "restore"}
        onClose={close}
        onConfirm={() => submit(false)}
        title={`Restore ${intake.code}?`}
        description={`${intake.litres.toLocaleString()} L into ${intake.tankName}.`}
        confirmLabel="Restore delivery"
        pendingLabel="Restoring…"
        pending={setVoided.isPending}
      >
        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          It counts towards stock, the reconciliation and fuel costs again.
        </p>
      </ConfirmDialog>
    </>
  );
}
