"use client";

import { LoaderCircle, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { PrimaryButton, SecondaryButton } from "@/components/modals/fields";
import Modal from "@/components/modals/modal";
import { useDeleteEquipmentTypes } from "@/queries/standardsMutations";
import type { EquipmentTypeRow } from "@/types/standards";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after at least one type was deleted, e.g. to clear a selection. */
  onDeleted?: () => void;
  types: EquipmentTypeRow[];
};

export default function DeleteEquipmentTypesModal({ open, ...props }: Props) {
  if (!open) return null;
  return <DeleteForm {...props} />;
}

function DeleteForm({ onClose, onDeleted, types }: Omit<Props, "open">) {
  const single = types.length === 1;
  const inUse = types.filter((t) => t.unitCount > 0);
  const deletable = types.length - inUse.length;

  const mutation = useDeleteEquipmentTypes();
  const pending = mutation.isPending;

  return (
    <Modal
      open
      onClose={onClose}
      title={single ? `Delete ${types[0].name}?` : `Delete ${types.length} equipment types?`}
      description="This removes the type and its consumption standard. It can't be undone."
      footer={
        <>
          <PrimaryButton type="submit" form="delete-equipment-types" disabled={pending || deletable === 0}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
            {pending ? "Deleting…" : single ? "Delete type" : `Delete ${deletable === types.length ? "types" : `${deletable} of ${types.length}`}`}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onClose} disabled={pending}>
            Cancel
          </SecondaryButton>
        </>
      }
    >
      <form
        id="delete-equipment-types"
        className="space-y-4 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(new FormData(event.currentTarget), {
            onSuccess: (result) => {
              toast.success(single ? "Equipment type deleted" : "Equipment types deleted", { description: result.message });
              onDeleted?.();
              onClose();
            },
            onError: (error) => {
              // Some deleted, some not: the list refreshes behind the modal, so drop the stale selection.
              if (error.message.startsWith("Deleted")) onDeleted?.();
            },
          });
        }}
      >

        {types.map((t) => (
          <input key={t.id} type="hidden" name="id" value={t.id} />
        ))}

        {!single && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {types.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                <span className="font-medium text-slate-900">{t.name}</span>
                <span className={t.unitCount > 0 ? "text-brand-700" : "text-slate-500"}>
                  {t.unitCount > 0 ? `${t.unitCount} unit${t.unitCount === 1 ? "" : "s"} — can't delete` : "No units"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {inUse.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {single
              ? `${types[0].unitCount} unit${types[0].unitCount === 1 ? " uses" : "s use"} this type. Move ${types[0].unitCount === 1 ? "it" : "them"} to another type on Equipment & Vehicles first.`
              : "Types that equipment still uses are skipped. Move those units to another type first."}
          </p>
        )}
      </form>
    </Modal>
  );
}
