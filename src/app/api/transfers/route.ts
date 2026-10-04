import { withActor } from "@/app/api/_lib/routeHandler";
import { TankTransferService } from "@/services/tankTransferService";

/** `TransferRow[]`: the 50 most recent tank-to-tank transfers, newest first. */
export const GET = withActor(() => TankTransferService.list({ limit: 50 }), { admin: true });
