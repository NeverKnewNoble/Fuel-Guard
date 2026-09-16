"use server";

import { FuelEntryCorrectionService } from "@/services/fuelEntryCorrectionService";
import { FuelEntryService } from "@/services/fuelEntryService";
import { SessionService } from "@/services/sessionService";
import type { ActionState } from "@/types/actions";
import { accraDateTime, formText, optionalNumber, requiredNumber, toErrorState } from "@/utils/actionUtils";

// Called through TanStack mutations (src/queries/fuelEntryMutations.ts), which refresh the affected queries.

const STATUS_NOTE = {
  flagged: " Flagged for review.",
  watch: " Added to the watchlist.",
  locked: "",
} as const;

export async function createFuelEntryAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const result = await FuelEntryService.create(
      {
        dispensedAt: accraDateTime(formData.get("date"), formData.get("time")),
        equipmentId: formText(formData.get("equipmentId")),
        tankId: formText(formData.get("tankId")),
        operatorId: formText(formData.get("operatorId")),
        litres: requiredNumber(formData.get("litres")),
        odometerStart: optionalNumber(formData.get("odometerStart")),
        odometerEnd: optionalNumber(formData.get("odometerEnd")),
        hourMeterStart: optionalNumber(formData.get("hourMeterStart")),
        hourMeterEnd: optionalNumber(formData.get("hourMeterEnd")),
        locationActivity: formText(formData.get("locationActivity")),
      },
      actor
    );

    return {
      ok: true,
      message: `${result.entry.code} saved.${STATUS_NOTE[result.entry.status]}${result.warnings.length ? ` ${result.warnings.join(" ")}` : ""}`,
    };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Sends every correctable field; the service keeps only what actually changed. */
export async function requestCorrectionAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await FuelEntryCorrectionService.request(
      {
        fuelEntryId: formText(formData.get("fuelEntryId")),
        reason: formText(formData.get("reason")),
        changes: {
          dispensedAt: accraDateTime(formData.get("date"), formData.get("time")),
          operatorId: formText(formData.get("operatorId")),
          litres: requiredNumber(formData.get("litres")),
          odometerStart: optionalNumber(formData.get("odometerStart")),
          odometerEnd: optionalNumber(formData.get("odometerEnd")),
          hourMeterStart: optionalNumber(formData.get("hourMeterStart")),
          hourMeterEnd: optionalNumber(formData.get("hourMeterEnd")),
          locationActivity: formText(formData.get("locationActivity")),
        },
      },
      actor
    );
    return { ok: true, message: "An administrator will review it. The entry is unchanged until then." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function approveCorrectionAction(input: { id: string }): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await FuelEntryCorrectionService.approve(String(input?.id ?? ""), actor);
    return { ok: true, message: "The entry was updated and re-checked against its standard." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function rejectCorrectionAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await FuelEntryCorrectionService.reject(formText(formData.get("id")), formText(formData.get("note")), actor);
    return { ok: true, message: "The entry keeps its original values." };
  } catch (error) {
    return toErrorState(error);
  }
}

/** An administrator's direct edit. Records takers use `requestCorrectionAction` instead. */
export async function updateFuelEntryAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const result = await FuelEntryService.update(
      formText(formData.get("id")),
      {
        dispensedAt: accraDateTime(formData.get("date"), formData.get("time")),
        // Equipment and tanker can't move: void the entry and record another instead.
        equipmentId: formText(formData.get("equipmentId")),
        tankId: formText(formData.get("tankId")),
        operatorId: formText(formData.get("operatorId")),
        litres: requiredNumber(formData.get("litres")),
        odometerStart: optionalNumber(formData.get("odometerStart")),
        odometerEnd: optionalNumber(formData.get("odometerEnd")),
        hourMeterStart: optionalNumber(formData.get("hourMeterStart")),
        hourMeterEnd: optionalNumber(formData.get("hourMeterEnd")),
        locationActivity: formText(formData.get("locationActivity")),
      },
      actor
    );
    return { ok: true, message: `Re-checked against the standard:${STATUS_NOTE[result.status] || " no alerts raised."}` };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Voids an entry recorded in error, or restores one. `reason` is required when voiding. */
export async function setFuelEntryVoidedAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const voided = formText(formData.get("voided")) === "true";
    await FuelEntryService.setVoided(
      formText(formData.get("id")),
      { voided, reason: formText(formData.get("reason")) },
      actor
    );
    return {
      ok: true,
      message: voided
        ? "It stays in the log for the record, but no longer counts towards litres, costs or the monthly summary."
        : "It counts towards litres, costs and the monthly summary again.",
    };
  } catch (error) {
    return toErrorState(error);
  }
}
