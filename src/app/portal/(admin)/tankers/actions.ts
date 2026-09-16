"use server";

import { SessionService } from "@/services/sessionService";
import { TankDipService } from "@/services/tankDipService";
import { TankIntakeService } from "@/services/tankIntakeService";
import { TankService } from "@/services/tankService";
import { formatLitres } from "@/services/utils";
import type { ActionState } from "@/types/actions";
import type { TankKind } from "@/types/tank";
import { accraDateTime, formText, oneOf, optionalNumber, requiredNumber, toErrorState } from "@/utils/actionUtils";

// Called through TanStack mutations (src/queries/tankMutations.ts), which refresh the affected queries.

const KINDS: TankKind[] = ["bulk", "mobile_bowser", "day_tank"];

export async function createTankAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const created = await TankService.create(
      {
        code: formText(formData.get("code")) || undefined,
        name: formText(formData.get("name")),
        // An unknown kind reaches the service as-is, which rejects it with a field message.
        kind: (oneOf(formData.get("kind"), KINDS) ?? formText(formData.get("kind"))) as TankKind,
        siteId: formText(formData.get("siteId")),
        capacityL: requiredNumber(formData.get("capacityL")),
        openingL: optionalNumber(formData.get("openingL")),
      },
      actor
    );
    return { ok: true, message: `${created.code} added.` };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function updateTankAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await TankService.update(
      formText(formData.get("id")),
      {
        code: formText(formData.get("code")),
        name: formText(formData.get("name")),
        kind: (oneOf(formData.get("kind"), KINDS) ?? formText(formData.get("kind"))) as TankKind,
        siteId: formText(formData.get("siteId")),
        capacityL: requiredNumber(formData.get("capacityL")),
      },
      actor
    );
    return { ok: true, message: "Changes saved." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function archiveTankAction(input: { id: string }): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await TankService.archive(String(input?.id ?? ""), actor);
    return { ok: true, message: "It no longer appears in tanker lists or the reconciliation." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function recordIntakeAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const litres = requiredNumber(formData.get("litres"));
    const created = await TankIntakeService.create(
      {
        tankId: formText(formData.get("tankId")),
        supplierName: formText(formData.get("supplierName")),
        deliveryNote: formText(formData.get("deliveryNote")),
        litres,
        costPerLitre: requiredNumber(formData.get("costPerLitre")),
        receivedAt: accraDateTime(formData.get("date"), formData.get("time")),
        receivedById: formText(formData.get("receivedById")),
      },
      actor
    );
    return {
      ok: true,
      message: `${created.code}: ${formatLitres(litres)} L, GHS ${created.totalCost.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
    };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function recordDipAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const measuredL = requiredNumber(formData.get("measuredL"));
    await TankDipService.record(
      {
        tankId: formText(formData.get("tankId")),
        measuredL,
        measuredAt: accraDateTime(formData.get("date"), formData.get("time")),
        note: formText(formData.get("note")) || undefined,
      },
      actor
    );
    return { ok: true, message: `${formatLitres(measuredL)} L recorded. The level and reconciliation are updated.` };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Corrects a delivery. The tanker can't change — void it and record another instead. */
export async function updateIntakeAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await TankIntakeService.update(
      formText(formData.get("id")),
      {
        supplierName: formText(formData.get("supplierName")),
        deliveryNote: formText(formData.get("deliveryNote")),
        litres: requiredNumber(formData.get("litres")),
        costPerLitre: requiredNumber(formData.get("costPerLitre")),
        receivedAt: accraDateTime(formData.get("date"), formData.get("time")),
        receivedById: formText(formData.get("receivedById")),
      },
      actor
    );
    return { ok: true, message: "Stock levels and costs follow the corrected figures." };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Voids a delivery recorded in error, or restores one. `reason` is required when voiding. */
export async function setIntakeVoidedAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const voided = formText(formData.get("voided")) === "true";
    await TankIntakeService.setVoided(
      formText(formData.get("id")),
      { voided, reason: formText(formData.get("reason")) },
      actor
    );
    return {
      ok: true,
      message: voided
        ? "It stays in the log for the record, but no longer counts towards stock or costs."
        : "It counts towards stock and costs again.",
    };
  } catch (error) {
    return toErrorState(error);
  }
}
