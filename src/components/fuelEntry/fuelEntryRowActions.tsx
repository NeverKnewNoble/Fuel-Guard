"use client";

import { Ban, FilePenLine, Pencil, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/modals/confirmDialog";
import EditFuelEntryModal from "@/components/modals/editFuelEntryModal";
import RequestCorrectionModal from "@/components/modals/requestCorrectionModal";
import VoidRecordModal from "@/components/modals/voidRecordModal";
import RowActions from "@/components/ui/rowActions";
import { useSetFuelEntryVoided } from "@/queries/fuelEntryMutations";
import type { LogEntryRow } from "@/types/fuelLog";

/**
 * ⋯ menu on an entry row. Records takers can only request a correction; an administrator edits directly,
 * or voids an entry recorded in error — entries are never deleted, so the month's history stays complete.
 */
export function FuelEntryRowActions({ entry, isAdmin }: { entry: LogEntryRow; isAdmin: boolean }) {
  const [dialog, setDialog] = useState<"correct" | "edit" | "void" | "restore" | null>(null);
  const setVoided = useSetFuelEntryVoided();
  const close = () => {
    setDialog(null);
    setVoided.reset();
  };

  const voided = entry.voidedAt !== null;

  function submit(voidIt: boolean, reason = "") {
    const formData = new FormData();
    formData.set("id", entry.id);
    formData.set("voided", String(voidIt));
    formData.set("reason", reason);
    setVoided.mutate(formData, {
      onSuccess: (result) => {
        toast.success(voidIt ? `${entry.code} voided` : `${entry.code} restored`, { description: result.message });
        setDialog(null);
      },
    });
  }

  return (
    <>
      <RowActions
        label={`${entry.code} for ${entry.equipmentCode}`}
        items={[
          { label: "Request correction", icon: FilePenLine, onSelect: () => setDialog("correct"), hidden: isAdmin || voided },
          { label: "Edit", icon: Pencil, onSelect: () => setDialog("edit"), hidden: !isAdmin || voided },
          { label: "Void", icon: Ban, onSelect: () => setDialog("void"), hidden: !isAdmin || voided, tone: "danger", separated: true },
          { label: "Restore", icon: Undo2, onSelect: () => setDialog("restore"), hidden: !isAdmin || !voided },
        ]}
      />

      <RequestCorrectionModal open={dialog === "correct"} onClose={close} entryId={entry.id} entryCode={entry.code} />
      <EditFuelEntryModal open={dialog === "edit"} onClose={close} entryId={entry.id} entryCode={entry.code} />

      <VoidRecordModal
        open={dialog === "void"}
        onClose={close}
        onConfirm={(reason) => submit(true, reason)}
        title={`Void ${entry.code}?`}
        description={`${entry.litres.toLocaleString()} L on ${entry.equipmentCode}, recorded by ${entry.recordedBy}.`}
        confirmLabel="Void entry"
        pending={setVoided.isPending}
      >
        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          It stays in the log, marked void, but stops counting towards litres issued, fuel costs, the tanker&apos;s level
          and the monthly summary. Alerts it raised stay as history. You can restore it later.
        </p>
      </VoidRecordModal>

      <ConfirmDialog
        open={dialog === "restore"}
        onClose={close}
        onConfirm={() => submit(false)}
        title={`Restore ${entry.code}?`}
        description={`${entry.litres.toLocaleString()} L on ${entry.equipmentCode}.`}
        confirmLabel="Restore entry"
        pendingLabel="Restoring…"
        pending={setVoided.isPending}
      >
        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          It counts towards litres, costs and the monthly summary again.
        </p>
      </ConfirmDialog>
    </>
  );
}
