import { uuidParam } from "@/app/api/_lib/params";
import { withActor } from "@/app/api/_lib/routeHandler";
import { EquipmentService } from "@/services/equipmentService";

/** `EquipmentDetail`: one unit with its type, site and overrides, for the Edit form. */
export const GET = withActor<RouteContext<"/api/equipment/[id]">>(
  async ({ context }) => EquipmentService.getById(uuidParam((await context.params).id, "Equipment")),
  { admin: true }
);
