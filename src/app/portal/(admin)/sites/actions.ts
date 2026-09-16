"use server";

import { SessionService } from "@/services/sessionService";
import { SiteService } from "@/services/siteService";
import type { ActionState } from "@/types/actions";
import { formText, optionalText, toErrorState } from "@/utils/actionUtils";

// Called through TanStack mutations (src/queries/setupMutations.ts), which refresh the affected queries.

export async function createSiteAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const created = await SiteService.create(
      {
        code: formText(formData.get("code")),
        name: formText(formData.get("name")),
        region: formText(formData.get("region")),
      },
      actor
    );
    return { ok: true, message: `${created.code} can now be used for equipment, tankers and accounts.` };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function updateSiteAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await SiteService.update(
      formText(formData.get("id")),
      { name: formText(formData.get("name")), region: optionalText(formData.get("region")) },
      actor
    );
    return { ok: true, message: "Changes saved." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function archiveSiteAction(input: { id: string }): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await SiteService.archive(String(input?.id ?? ""), actor);
    return { ok: true, message: "It no longer appears in site pickers. Past records keep it." };
  } catch (error) {
    return toErrorState(error);
  }
}
