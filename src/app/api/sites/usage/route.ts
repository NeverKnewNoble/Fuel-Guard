import { withActor } from "@/app/api/_lib/routeHandler";
import { SiteService } from "@/services/siteService";

/** `SiteUsageRow[]`: every site, archived ones included, with the equipment and tanks based there. */
export const GET = withActor(() => SiteService.listWithUsage({ includeArchived: true }), { admin: true });
