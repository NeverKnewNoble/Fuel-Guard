import { uuidParam } from "@/app/api/_lib/params";
import { withActor } from "@/app/api/_lib/routeHandler";
import { TankService } from "@/services/tankService";

/** `TankDetail`: one tanker with its kind and site, for the Edit form. */
export const GET = withActor<RouteContext<"/api/tanks/[id]">>(
  async ({ context }) => TankService.getById(uuidParam((await context.params).id, "Tanker")),
  { admin: true }
);
