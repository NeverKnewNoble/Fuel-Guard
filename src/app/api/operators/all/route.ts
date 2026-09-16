import { withActor } from "@/app/api/_lib/routeHandler";
import { OperatorService } from "@/services/operatorService";

/** `OperatorRow[]`: every operator for the Operators page, deactivated ones included. */
export const GET = withActor(() => OperatorService.list({ includeInactive: true }), { admin: true });
