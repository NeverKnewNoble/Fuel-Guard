import { withActor } from "@/app/api/_lib/routeHandler";
import { TankService } from "@/services/tankService";

/** `TankCardData[]`: non-archived tankers with their latest dip level, for the tank cards. */
export const GET = withActor(() => TankService.listWithLevels(), { admin: true });
