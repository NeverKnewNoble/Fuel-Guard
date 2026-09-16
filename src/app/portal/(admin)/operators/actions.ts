"use server";

import { OperatorService } from "@/services/operatorService";
import { SessionService } from "@/services/sessionService";
import type { ActionState } from "@/types/actions";
import { formText, optionalText, toErrorState } from "@/utils/actionUtils";

// Called through TanStack mutations (src/queries/setupMutations.ts), which refresh the affected queries.

export async function createOperatorAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const name = formText(formData.get("name"));
    await OperatorService.create(
      {
        name,
        phone: formText(formData.get("phone")) || undefined,
        siteId: formText(formData.get("siteId")) || undefined,
        userId: formText(formData.get("userId")) || undefined,
      },
      actor
    );
    return { ok: true, message: `${name} can now be picked when recording a fill.` };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Saves the details and the linked account together; the service keeps them as separate steps. */
export async function updateOperatorAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const id = formText(formData.get("id"));

    await OperatorService.update(
      id,
      {
        name: formText(formData.get("name")),
        phone: optionalText(formData.get("phone")),
        siteId: optionalText(formData.get("siteId")),
      },
      actor
    );

    const userId = optionalText(formData.get("userId"));
    if (userId !== optionalText(formData.get("currentUserId"))) {
      await OperatorService.linkUser(id, userId, actor);
    }
    return { ok: true, message: "Changes saved." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function setOperatorActiveAction(input: { id: string; isActive: boolean }): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await OperatorService.setActive(String(input?.id ?? ""), Boolean(input?.isActive), actor);
    return {
      ok: true,
      message: input?.isActive
        ? "They can be picked when recording a fill again."
        : "They can no longer be picked. Past fuel entries keep their name.",
    };
  } catch (error) {
    return toErrorState(error);
  }
}
