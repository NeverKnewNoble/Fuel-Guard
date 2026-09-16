import { withActor } from "@/app/api/_lib/routeHandler";
import { EquipmentService } from "@/services/equipmentService";

/**
 * `EquipmentFormOption[]`: units that can draw fuel (active or idle) for the New Fuel Entry form.
 * Not admin-only, and a records taker only sees their own site's units.
 */
export const GET = withActor(({ actor }) => EquipmentService.listForEntryForm(actor));
