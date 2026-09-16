import { withActor } from "@/app/api/_lib/routeHandler";
import { TankIntakeService } from "@/services/tankIntakeService";

/** `IntakeRow[]`: the 50 most recent deliveries, newest first. */
export const GET = withActor(() => TankIntakeService.list({ limit: 50 }), { admin: true });
