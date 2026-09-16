"use client";

import {
  markAlertReadAction,
  markAllAlertsReadAction,
  reopenAlertAction,
  resolveAlertAction,
  startAlertReviewAction,
} from "@/app/portal/(admin)/theft_alerts/actions";
import { queryKeys } from "@/queries/keys";
import { useActionMutation } from "@/queries/useActionMutation";

// The queue, the stat tiles and the sidebar badge all sit under `alerts`; the dashboard shows open alerts too.
const keys = [queryKeys.alerts.all, queryKeys.dashboard.all];

export const useMarkAlertRead = () => useActionMutation({ action: markAlertReadAction, invalidates: [queryKeys.alerts.all], errorTitle: "Couldn't update the alert" });

export const useMarkAllAlertsRead = () => useActionMutation({ action: markAllAlertsReadAction, invalidates: [queryKeys.alerts.all], errorTitle: "Couldn't mark them as read" });

export const useStartAlertReview = () => useActionMutation({ action: startAlertReviewAction, invalidates: keys, errorTitle: "Couldn't start the review" });

export const useResolveAlert = () => useActionMutation({ action: resolveAlertAction, invalidates: keys, errorTitle: "Couldn't resolve the alert" });

export const useReopenAlert = () => useActionMutation({ action: reopenAlertAction, invalidates: keys, errorTitle: "Couldn't reopen the alert" });
