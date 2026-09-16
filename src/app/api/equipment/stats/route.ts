import { withActor } from "@/app/api/_lib/routeHandler";
import { EquipmentService } from "@/services/equipmentService";

/** `EquipmentStats`: unit counts by status. */
export const GET = withActor(() => EquipmentService.getStats(), { admin: true });
