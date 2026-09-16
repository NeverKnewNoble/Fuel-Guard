import { withActor } from "@/app/api/_lib/routeHandler";
import { ReconciliationService } from "@/services/reconciliationService";

/** `ReconciliationReport`: this month's stock reconciliation per tanker, with the month and total loss. */
export const GET = withActor(() => ReconciliationService.getCurrentReport(), { admin: true });
