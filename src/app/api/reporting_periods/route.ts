import { withActor } from "@/app/api/_lib/routeHandler";
import { ReportingPeriodService } from "@/services/reportingPeriodService";

/** `ReportingPeriodListItem[]`: months newest first, for the Monthly Summary picker. */
export const GET = withActor(() => ReportingPeriodService.list(), { admin: true });
