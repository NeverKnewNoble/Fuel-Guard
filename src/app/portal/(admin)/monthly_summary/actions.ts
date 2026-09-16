"use server";

import { ReportingPeriodService } from "@/services/reportingPeriodService";
import { SessionService } from "@/services/sessionService";
import type { ActionState } from "@/types/actions";
import { toErrorState } from "@/utils/actionUtils";

// Called through TanStack mutations (src/queries/monthlyMutations.ts), which refresh the affected queries.

export async function closePeriodAction(input: { id: string }): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await ReportingPeriodService.close(String(input?.id ?? ""), actor);
    return { ok: true, message: "Each tanker's closing dip is now next month's opening balance." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function reopenPeriodAction(input: { id: string }): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await ReportingPeriodService.reopen(String(input?.id ?? ""), actor);
    return { ok: true, message: "Entries and deliveries dated in this month can be recorded again." };
  } catch (error) {
    return toErrorState(error);
  }
}
