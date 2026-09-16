import { withActor } from "@/app/api/_lib/routeHandler";
import { SiteService } from "@/services/siteService";
import type { CurrentUser } from "@/types/user";

/** `CurrentUser`: the signed-in user with their default site's name, for forms that fill it in. */
export const GET = withActor(async ({ actor }): Promise<CurrentUser> => {
  const site = actor.siteId ? await SiteService.getById(actor.siteId).catch(() => null) : null;
  return { id: actor.id, role: actor.role, siteId: actor.siteId, siteName: site?.name ?? null };
});
