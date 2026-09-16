import { withActor } from "@/app/api/_lib/routeHandler";
import { EquipmentService } from "@/services/equipmentService";

/** `EquipmentRow[]`: the registry, including retired units, ordered by code. */
export const GET = withActor(() => EquipmentService.list(), { admin: true });
