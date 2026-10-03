"use client";

import { Ban, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/modals/confirmDialog";
import VoidRecordModal from "@/components/modals/voidRecordModal";
import RowActions from "@/components/ui/rowActions";
import { useSetTransferVoided } from "@/queries/tankMutations";
import type { TransferRow } from "@/types/tank";

/** ⋯ menu on a transfer row. Transfers are voided, never deleted, so stock history stays intact. */
export function TransferRowActions({ transfer }: { transfer: TransferRow }) {
  const [dialog, setDialog] = useState<"void" | "restore" | null>(null);
  const setVoided = useSetTransferVoided();
  const close = () => {
    setDialog(null);
    setVoided.reset();
  };

  const voided = transfer.voidedAt !== null;
  const movement = `${transfer.litres.toLocaleString()} L from ${transfer.fromTankName} to ${transfer.toTankName}.`;

  function submit(voidIt: boolean, reason = "") {
    const formData = new FormData();
    formData.set("id", transfer.id);
    formData.set("voided", String(voidIt));
    formData.set("reason", reason);
    setVoided.mutate(formData, {
      onSuccess: (result) => {
        toast.success(voidIt ? `${transfer.code} voided` : `${transfer.code} restored`, { description: result.message });
        setDialog(null);
      },
    });
  }

  return (
    <>
      <RowActions
        label={`${transfer.code} from ${transfer.fromTankName} to ${transfer.toTankName}`}
        items={[
          { label: "Void", icon: Ban, onSelect: () => setDialog("void"), hidden: voided, tone: "danger" },
          { label: "Restore", icon: Undo2, onSelect: () => setDialog("restore"), hidden: !voided },
        ]}
      />

      <VoidRecordModal
        open={dialog === "void"}
        onClose={close}
        onConfirm={(reason) => submit(true, reason)}
        title={`Void ${transfer.code}?`}
        description={movement}
        confirmLabel="Void transfer"
        pending={setVoided.isPending}
      >
        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          It stays in the transfer log, marked void, but the fuel counts as never having moved: both tank levels and the
          month&apos;s reconciliation go back. You can restore it later.
        </p>
      </VoidRecordModal>

      <ConfirmDialog
        open={dialog === "restore"}
        onClose={close}
        onConfirm={() => submit(false)}
        title={`Restore ${transfer.code}?`}
        description={movement}
        confirmLabel="Restore transfer"
        pendingLabel="Restoring…"
        pending={setVoided.isPending}
      >
        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          It moves the fuel between the two tanks again, in their levels and the reconciliation.
        </p>
      </ConfirmDialog>
    </>
  );
}
