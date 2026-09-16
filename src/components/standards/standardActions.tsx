"use client";

import { useState } from "react";

import DeleteEquipmentTypesModal from "@/components/modals/deleteEquipmentTypesModal";
import EquipmentTypeModal from "@/components/modals/equipmentTypeModal";
import RowActions from "@/components/ui/rowActions";
import { SelectionBar } from "@/components/ui/selection";
import type { EquipmentTypeRow } from "@/types/standards";

/** ⋯ menu on one equipment type row: Edit opens the standard form, Delete asks for confirmation. */
export function StandardRowActions({ type }: { type: EquipmentTypeRow }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const close = () => setDialog(null);

  return (
    <>
      <RowActions label={`${type.name} standard`} onEdit={() => setDialog("edit")} onDelete={() => setDialog("delete")} />
      <EquipmentTypeModal open={dialog === "edit"} onClose={close} type={type} />
      <DeleteEquipmentTypesModal open={dialog === "delete"} onClose={close} types={[type]} />
    </>
  );
}

/** Selection bar whose Delete confirms, then deletes every selected type. */
export function StandardsSelectionBar({ types }: { types: EquipmentTypeRow[] }) {
  const [pending, setPending] = useState<{ types: EquipmentTypeRow[]; clear: () => void } | null>(null);

  return (
    <>
      <SelectionBar
        noun="standard"
        actions={["delete"]}
        onDelete={(ids, clear) => setPending({ types: types.filter((t) => ids.includes(t.id)), clear })}
      />
      <DeleteEquipmentTypesModal
        open={pending !== null && pending.types.length > 0}
        onClose={() => setPending(null)}
        onDeleted={() => pending?.clear()}
        types={pending?.types ?? []}
      />
    </>
  );
}
