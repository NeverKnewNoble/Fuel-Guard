"use server";

import { EquipmentService } from "@/services/equipmentService";
import { SessionService } from "@/services/sessionService";
import type { ActionState } from "@/types/actions";
import type { EquipmentRecordStatus } from "@/types/equipment";
import { formText, oneOf, optionalNumber, optionalText, toErrorState } from "@/utils/actionUtils";

// Called through TanStack mutations (src/queries/equipmentMutations.ts), which refresh the affected queries.

const STATUSES: EquipmentRecordStatus[] = ["active", "maintenance", "idle", "retired"];

/**
 * The form only shows the standard field for the chosen type's basis (`lKmStandardOverride` or
 * `lHrStandardOverride`); the missing one reads as `null`, which is what the other basis needs anyway.
 */
function equipmentFields(formData: FormData) {
  return {
    equipmentTypeId: formText(formData.get("equipmentTypeId")),
    makeModel: formText(formData.get("makeModel")),
    registrationNo: optionalText(formData.get("registrationNo")),
    fuelTankCapacityL: optionalNumber(formData.get("fuelTankCapacityL")),
    lKmStandardOverride: optionalNumber(formData.get("lKmStandardOverride")),
    lHrStandardOverride: optionalNumber(formData.get("lHrStandardOverride")),
  };
}

export async function createEquipmentAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const created = await EquipmentService.create(
      {
        ...equipmentFields(formData),
        code: formText(formData.get("code")) || undefined,
        siteId: formText(formData.get("siteId")),
      },
      actor
    );
    return { ok: true, message: `${created.code} added to the registry.` };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Edits everything but the site (see `moveEquipmentAction`) and status (see `setEquipmentStatusAction`). */
export async function updateEquipmentAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await EquipmentService.update(
      formText(formData.get("id")),
      { ...equipmentFields(formData), code: formText(formData.get("code")) },
      actor
    );
    return { ok: true, message: "Changes saved." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function setEquipmentStatusAction(input: { id: string; status: EquipmentRecordStatus }): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const status = oneOf(input?.status, STATUSES);
    if (!status) return { ok: false, error: "Pick a status." };
    await EquipmentService.setStatus(String(input.id), status, actor);
    return {
      ok: true,
      message: status === "retired" ? "Retired units stay in history but no longer appear in forms." : "Status updated.",
    };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function moveEquipmentAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await EquipmentService.moveToSite(formText(formData.get("id")), formText(formData.get("siteId")), actor);
    return { ok: true, message: "Past fuel entries keep the site they were recorded at." };
  } catch (error) {
    return toErrorState(error);
  }
}
