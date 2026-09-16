"use client";

import {
  approveCorrectionAction,
  createFuelEntryAction,
  rejectCorrectionAction,
  requestCorrectionAction,
  setFuelEntryVoidedAction,
  updateFuelEntryAction,
} from "@/app/portal/fuel_entry/actions";
import { queryKeys } from "@/queries/keys";
import { useActionMutation } from "@/queries/useActionMutation";

// A fuel entry can raise alerts, changes the month's issued litres, and feeds the dashboard.
const entryKeys = [
  queryKeys.fuelEntries.all,
  queryKeys.alerts.all,
  queryKeys.reconciliation.all,
  queryKeys.dashboard.all,
];

export const useCreateFuelEntry = () => useActionMutation({ action: createFuelEntryAction, invalidates: entryKeys, errorTitle: "Couldn't save the entry" });

export const useRequestCorrection = () =>
  useActionMutation({ action: requestCorrectionAction, invalidates: [queryKeys.fuelEntries.all, queryKeys.corrections.all], errorTitle: "Couldn't send the request" });

// Approving rewrites the entry and can raise new alerts; rejecting only closes the request.
export const useApproveCorrection = () =>
  useActionMutation({ action: approveCorrectionAction, invalidates: [...entryKeys, queryKeys.corrections.all], errorTitle: "Couldn't approve the correction" });

export const useRejectCorrection = () =>
  useActionMutation({ action: rejectCorrectionAction, invalidates: [queryKeys.fuelEntries.all, queryKeys.corrections.all], errorTitle: "Couldn't reject the correction" });

// Editing or voiding an entry moves the month's litres and costs, and can raise alerts.
export const useUpdateFuelEntry = () =>
  useActionMutation({ action: updateFuelEntryAction, invalidates: entryKeys, errorTitle: "Couldn't save the changes" });

export const useSetFuelEntryVoided = () =>
  useActionMutation({ action: setFuelEntryVoidedAction, invalidates: entryKeys, errorTitle: "Couldn't update the entry" });
