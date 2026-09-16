"use client";

import { Archive, History, Pencil, Ruler } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/modals/confirmDialog";
import DipHistoryModal from "@/components/modals/dipHistoryModal";
import RecordDipModal, { type DipTarget } from "@/components/modals/recordDipModal";
import TankFormModal from "@/components/modals/tankFormModal";
import RowActions from "@/components/ui/rowActions";
import { useArchiveTank } from "@/queries/tankMutations";

/**
 * ⋯ menu for a tanker, used on the tank cards and the reconciliation rows.
 * `canEdit` hides Edit and Archive where only the dip actions make sense.
 */
export function TankRowActions({ tank, canEdit = true }: { tank: DipTarget; canEdit?: boolean }) {
  const [dialog, setDialog] = useState<"edit" | "dip" | "history" | "archive" | null>(null);
  const archive = useArchiveTank();
  const close = () => {
    setDialog(null);
    archive.reset();
  };

  return (
    <>
      <RowActions
        label={`${tank.name} (${tank.code})`}
        items={[
          { label: "Record dip", icon: Ruler, onSelect: () => setDialog("dip") },
          { label: "Dip history", icon: History, onSelect: () => setDialog("history") },
          { label: "Edit", icon: Pencil, onSelect: () => setDialog("edit"), hidden: !canEdit, separated: true },
          { label: "Archive", icon: Archive, onSelect: () => setDialog("archive"), hidden: !canEdit, tone: "danger", separated: true },
        ]}
      />
      <RecordDipModal open={dialog === "dip"} onClose={close} tank={tank} />
      <DipHistoryModal open={dialog === "history"} onClose={close} tank={tank} />
      <TankFormModal open={dialog === "edit"} onClose={close} tankId={tank.id} />
      <ConfirmDialog
        open={dialog === "archive"}
        onClose={close}
        onConfirm={() =>
          archive.mutate(
            { id: tank.id },
            {
              onSuccess: (result) => {
                toast.success(`${tank.name} archived`, { description: result.message });
                setDialog(null);
              },
            }
          )
        }
        title={`Archive ${tank.name}?`}
        description={tank.code}
        confirmLabel="Archive tanker"
        pendingLabel="Archiving…"
        pending={archive.isPending}
      >
        <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
          Only an empty tanker can be archived: record a dip of 0 L first. Its deliveries and fuel entries stay in history.
        </p>
      </ConfirmDialog>
    </>
  );
}
