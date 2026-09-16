import { withActor } from "@/app/api/_lib/routeHandler";
import { SiteService } from "@/services/siteService";

/** `SiteOption[]`: non-archived sites for "Site" selects, ordered by name. */
export const GET = withActor(() => SiteService.list());
