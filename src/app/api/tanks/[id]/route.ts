import { uuidParam } from "@/app/api/_lib/params";
import { withActor } from "@/app/api/_lib/routeHandler";
import { TankService } from "@/services/tankService";

/** `TankDetail`: one tank with its kind and site, for the Edit form. */
export const GET = withActor<RouteContext<"/api/tanks/[id]">>(
  async ({ context }) => TankService.getById(uuidParam((await context.params).id, "Tank")),
  { admin: true }
);
