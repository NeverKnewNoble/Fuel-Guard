"use client";

import {
  createEquipmentAction,
  moveEquipmentAction,
  setEquipmentStatusAction,
  updateEquipmentAction,
} from "@/app/portal/(admin)/equipment_and_vehicles/actions";
import { queryKeys } from "@/queries/keys";
import { useActionMutation } from "@/queries/useActionMutation";

// The registry, stats and detail all sit under `equipment`; equipment types show a unit count.
const keys = [queryKeys.equipment.all, queryKeys.standards.equipmentTypes()];

export const useCreateEquipment = () => useActionMutation({ action: createEquipmentAction, invalidates: keys, errorTitle: "Couldn't add the equipment" });

export const useUpdateEquipment = () => useActionMutation({ action: updateEquipmentAction, invalidates: keys, errorTitle: "Couldn't save the changes" });

export const useSetEquipmentStatus = () => useActionMutation({ action: setEquipmentStatusAction, invalidates: keys, errorTitle: "Couldn't update the status" });

export const useMoveEquipment = () => useActionMutation({ action: moveEquipmentAction, invalidates: [queryKeys.equipment.all], errorTitle: "Couldn't move the unit" });
