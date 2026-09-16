"use client";

import {
  archiveTankAction,
  createTankAction,
  recordDipAction,
  recordIntakeAction,
  setIntakeVoidedAction,
  updateIntakeAction,
  updateTankAction,
} from "@/app/portal/(admin)/tankers/actions";
import { queryKeys } from "@/queries/keys";
import { useActionMutation } from "@/queries/useActionMutation";

// Tank cards, selects, the reconciliation and the intake log all show tank names and levels.
const stockKeys = [queryKeys.tanks.all, queryKeys.reconciliation.all];

export const useCreateTank = () => useActionMutation({ action: createTankAction, invalidates: stockKeys, errorTitle: "Couldn't add the tanker" });

export const useUpdateTank = () =>
  useActionMutation({ action: updateTankAction, invalidates: [...stockKeys, queryKeys.intakes.all], errorTitle: "Couldn't save the changes" });

export const useArchiveTank = () => useActionMutation({ action: archiveTankAction, invalidates: stockKeys, errorTitle: "Couldn't archive the tanker" });

// A delivery can create a new supplier.
export const useRecordIntake = () =>
  useActionMutation({ action: recordIntakeAction, invalidates: [...stockKeys, queryKeys.intakes.all, queryKeys.suppliers.all], errorTitle: "Couldn't record the intake" });

export const useRecordDip = () => useActionMutation({ action: recordDipAction, invalidates: stockKeys, errorTitle: "Couldn't record the dip" });

// Correcting or voiding a delivery moves stock, the month's figures and the price fuel is costed at.
const intakeKeys = [...stockKeys, queryKeys.intakes.all, queryKeys.suppliers.all, queryKeys.dashboard.all];

export const useUpdateIntake = () =>
  useActionMutation({ action: updateIntakeAction, invalidates: intakeKeys, errorTitle: "Couldn't save the changes" });

export const useSetIntakeVoided = () =>
  useActionMutation({ action: setIntakeVoidedAction, invalidates: intakeKeys, errorTitle: "Couldn't update the delivery" });
