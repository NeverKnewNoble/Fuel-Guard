import { withActor } from "@/app/api/_lib/routeHandler";
import { OperatorService } from "@/services/operatorService";
import { SessionService } from "@/services/sessionService";

/**
 * `OperatorOption[]`: active drivers and operators for the New Fuel Entry form.
 * A records taker sees their own site's operators plus those who work at any site.
 */
export const GET = withActor(({ actor }) =>
  OperatorService.listActive({ siteId: SessionService.isAdmin(actor) ? undefined : actor.siteId })
);
