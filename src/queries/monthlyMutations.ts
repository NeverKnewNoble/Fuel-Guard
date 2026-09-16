"use client";

import { closePeriodAction, reopenPeriodAction } from "@/app/portal/(admin)/monthly_summary/actions";
import { queryKeys } from "@/queries/keys";
import { useActionMutation } from "@/queries/useActionMutation";

// Closing a month writes each tanker's opening and closing balances, which the reconciliation reads.
const keys = [
  queryKeys.reportingPeriods.all,
  queryKeys.monthlySummary.all,
  queryKeys.reconciliation.all,
  queryKeys.dashboard.all,
];

export const useClosePeriod = () => useActionMutation({ action: closePeriodAction, invalidates: keys, errorTitle: "Couldn't close the month" });
export const useReopenPeriod = () => useActionMutation({ action: reopenPeriodAction, invalidates: keys, errorTitle: "Couldn't reopen the month" });
