"use server";

import { SessionService } from "@/services/sessionService";
import { TheftAlertService } from "@/services/theftAlertService";
import type { ActionState } from "@/types/actions";
import { formText, toErrorState } from "@/utils/actionUtils";

// Called through TanStack mutations (src/queries/alertMutations.ts), which refresh the affected queries.

export async function markAlertReadAction(input: { id: string; read: boolean }): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const id = String(input?.id ?? "");
    if (input?.read) await TheftAlertService.markAsRead(id, actor.id);
    else await TheftAlertService.markAsUnread(id, actor.id);
    return { ok: true, message: input?.read ? "Marked as read." : "Marked as unread." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function markAllAlertsReadAction(): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    SessionService.assertAdmin(actor);
    await TheftAlertService.markAllAsRead(actor.id);
    return { ok: true, message: "Every unresolved alert is marked as read." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function startAlertReviewAction(input: { id: string }): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await TheftAlertService.startReview(String(input?.id ?? ""), actor);
    return { ok: true, message: "It's now under review." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function resolveAlertAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await TheftAlertService.resolve(formText(formData.get("id")), formText(formData.get("note")), actor);
    return { ok: true, message: "Resolved. Your name and note are recorded against it." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function reopenAlertAction(input: { id: string }): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await TheftAlertService.reopen(String(input?.id ?? ""), actor);
    return { ok: true, message: "It's open again, and the resolution note was cleared." };
  } catch (error) {
    return toErrorState(error);
  }
}
