"use client";

import {
  createOperatorAction,
  setOperatorActiveAction,
  updateOperatorAction,
} from "@/app/portal/(admin)/operators/actions";
import { archiveSiteAction, createSiteAction, updateSiteAction } from "@/app/portal/(admin)/sites/actions";
import { queryKeys } from "@/queries/keys";
import { useActionMutation } from "@/queries/useActionMutation";

// Site names appear on equipment, tankers, accounts and fuel entries, so those lists follow a rename.
const siteKeys = [
  queryKeys.sites.all,
  queryKeys.equipment.all,
  queryKeys.tanks.all,
  queryKeys.users.all,
  queryKeys.operators.all,
];

export const useCreateSite = () => useActionMutation({ action: createSiteAction, invalidates: siteKeys, errorTitle: "Couldn't add the site" });

export const useUpdateSite = () => useActionMutation({ action: updateSiteAction, invalidates: siteKeys, errorTitle: "Couldn't save the changes" });

export const useArchiveSite = () => useActionMutation({ action: archiveSiteAction, invalidates: siteKeys, errorTitle: "Couldn't archive the site" });

const operatorKeys = [queryKeys.operators.all];

export const useCreateOperator = () => useActionMutation({ action: createOperatorAction, invalidates: operatorKeys, errorTitle: "Couldn't add the operator" });

export const useUpdateOperator = () => useActionMutation({ action: updateOperatorAction, invalidates: operatorKeys, errorTitle: "Couldn't save the changes" });

export const useSetOperatorActive = () => useActionMutation({ action: setOperatorActiveAction, invalidates: operatorKeys, errorTitle: "Couldn't update the operator" });
