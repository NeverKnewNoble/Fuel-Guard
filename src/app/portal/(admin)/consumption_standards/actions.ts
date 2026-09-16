"use server";

import { AlertThresholdService } from "@/services/alertThresholdService";
import { EquipmentTypeService } from "@/services/equipmentTypeService";
import { ServiceError } from "@/services/errors";
import { SessionService } from "@/services/sessionService";
import type { ActionState } from "@/types/actions";
import type { Basis } from "@/types/standards";
import { optionalNumber, requiredNumber, toErrorState } from "@/utils/actionUtils";

// Called through TanStack mutations (src/queries/standardsMutations.ts), which refresh the affected queries.

export async function updateThresholdsAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await AlertThresholdService.update(
      {
        watch: requiredNumber(formData.get("watch")),
        high: requiredNumber(formData.get("high")),
        critical: requiredNumber(formData.get("critical")),
      },
      actor
    );
    return { ok: true, message: "Alert thresholds updated. New fuel entries use them straight away." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function createEquipmentTypeAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const basis = String(formData.get("basis") ?? "") as Basis;
    const created = await EquipmentTypeService.create(
      {
        name: String(formData.get("name") ?? ""),
        basis,
        ...standardFor(basis, formData),
      },
      actor
    );
    return { ok: true, message: `${created.name} added` };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function updateStandardAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const basis = String(formData.get("basis") ?? "") as Basis;
    await EquipmentTypeService.updateStandard(String(formData.get("id") ?? ""), { basis, ...standardFor(basis, formData) }, actor);
    return { ok: true, message: "Standard updated. Existing alerts aren't recalculated; new fuel entries use the new standard." };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Deletes every `id` in the form. Types still used by equipment are skipped and reported. */
export async function deleteEquipmentTypesAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    SessionService.assertAdmin(actor);

    const ids = formData.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return { ok: false, error: "Pick at least one equipment type." };

    const removed: string[] = [];
    const failed: string[] = [];
    for (const id of ids) {
      try {
        const type = await EquipmentTypeService.getById(id);
        await EquipmentTypeService.remove(id, actor);
        removed.push(type.name);
      } catch (error) {
        if (!(error instanceof ServiceError)) throw error;
        failed.push(error.message);
      }
    }

    const removedText = removed.length > 0 ? `Deleted ${removed.join(", ")}.` : "";
    if (failed.length > 0) {
      return { ok: false, error: [removedText, `Couldn't delete: ${failed.join(" ")}`].filter(Boolean).join(" ") };
    }
    return { ok: true, message: removedText };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Only the standard matching the basis is sent; the other is always cleared. */
function standardFor(basis: Basis, formData: FormData) {
  const value = optionalNumber(formData.get("standard"));
  return basis === "km" ? { lKmStandard: value ?? Number.NaN, lHrStandard: null } : { lKmStandard: null, lHrStandard: value ?? Number.NaN };
}
