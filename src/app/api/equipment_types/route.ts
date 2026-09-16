import { withActor } from "@/app/api/_lib/routeHandler";
import { EquipmentTypeService } from "@/services/equipmentTypeService";

/** `EquipmentTypeRow[]`, with each type's standard and unit count. */
export const GET = withActor(() => EquipmentTypeService.list(), { admin: true });
