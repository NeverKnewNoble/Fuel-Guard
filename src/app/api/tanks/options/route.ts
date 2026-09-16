import { withActor } from "@/app/api/_lib/routeHandler";
import { TankService } from "@/services/tankService";

/** `TankOption[]`: non-archived tankers for selects. Not admin-only: the New Fuel Entry form uses it too. */
export const GET = withActor(() => TankService.listForSelect());
