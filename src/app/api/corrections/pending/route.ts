import { withActor } from "@/app/api/_lib/routeHandler";
import { FuelEntryCorrectionService } from "@/services/fuelEntryCorrectionService";

/** `PendingCorrectionRow[]`: correction requests waiting for an administrator, oldest first. */
export const GET = withActor(({ actor }) => FuelEntryCorrectionService.listPending(actor), { admin: true });
