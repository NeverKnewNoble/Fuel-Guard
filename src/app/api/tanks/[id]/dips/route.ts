import { uuidParam } from "@/app/api/_lib/params";
import { withActor } from "@/app/api/_lib/routeHandler";
import { TankDipService } from "@/services/tankDipService";

/** `TankDipRow[]`: the tanker's last 30 dips, newest first. */
export const GET = withActor<RouteContext<"/api/tanks/[id]/dips">>(
  async ({ context }) => TankDipService.listForTank(uuidParam((await context.params).id, "Tanker")),
  { admin: true }
);
