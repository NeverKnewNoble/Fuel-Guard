"use client";

import {
  createEquipmentTypeAction,
  deleteEquipmentTypesAction,
  updateStandardAction,
  updateThresholdsAction,
} from "@/app/portal/(admin)/consumption_standards/actions";
import { queryKeys } from "@/queries/keys";
import { useActionMutation } from "@/queries/useActionMutation";

export const useUpdateThresholds = () =>
  useActionMutation({ action: updateThresholdsAction, invalidates: [queryKeys.standards.thresholds()], errorTitle: "Couldn't save the thresholds" });

// Equipment rows show each type's effective standard, so type changes refresh them too.
const typeKeys = [queryKeys.standards.equipmentTypes(), queryKeys.equipment.all];

export const useCreateEquipmentType = () => useActionMutation({ action: createEquipmentTypeAction, invalidates: typeKeys, errorTitle: "Couldn't add the equipment type" });

export const useUpdateStandard = () => useActionMutation({ action: updateStandardAction, invalidates: typeKeys, errorTitle: "Couldn't save the standard" });

export const useDeleteEquipmentTypes = () => useActionMutation({ action: deleteEquipmentTypesAction, invalidates: typeKeys, errorTitle: "Couldn't delete" });
