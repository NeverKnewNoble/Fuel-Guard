"use client";

import {
  changeUserRoleAction,
  createUserAction,
  setUserPasswordAction,
  setUserStatusAction,
  updateUserProfileAction,
} from "@/app/portal/(admin)/users_and_roles/actions";
import { queryKeys } from "@/queries/keys";
import { useActionMutation } from "@/queries/useActionMutation";

const keys = [queryKeys.users.all];

export const useCreateUser = () => useActionMutation({ action: createUserAction, invalidates: keys, errorTitle: "Couldn't create the user" });

export const useUpdateUserProfile = () => useActionMutation({ action: updateUserProfileAction, invalidates: keys, errorTitle: "Couldn't save the changes" });

export const useChangeUserRole = () => useActionMutation({ action: changeUserRoleAction, invalidates: keys, errorTitle: "Couldn't change the role" });

export const useSetUserStatus = () => useActionMutation({ action: setUserStatusAction, invalidates: keys, errorTitle: "Couldn't update the account" });

export const useSetUserPassword = () => useActionMutation({ action: setUserPasswordAction, invalidates: keys, errorTitle: "Couldn't set the password" });
