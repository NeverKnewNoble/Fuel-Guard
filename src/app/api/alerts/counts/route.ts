import { withActor } from "@/app/api/_lib/routeHandler";
import { TheftAlertService } from "@/services/theftAlertService";

/** `AlertCounts`: open counts by severity, plus this month's resolved count. */
export const GET = withActor(() => TheftAlertService.getCounts(), { admin: true });
