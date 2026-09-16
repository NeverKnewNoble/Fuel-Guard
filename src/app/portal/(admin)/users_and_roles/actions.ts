"use server";

import { SessionService } from "@/services/sessionService";
import { UserService } from "@/services/userService";
import type { AccountStatus } from "@/types/account";
import type { ActionState } from "@/types/actions";
import type { AppUserRole } from "@/types/next-auth";
import { formText, oneOf, optionalText, toErrorState } from "@/utils/actionUtils";

// Called through TanStack mutations (src/queries/userMutations.ts), which refresh the affected queries.

const ROLES: AppUserRole[] = ["administrator", "records_taker"];
const STATUSES: AccountStatus[] = ["active", "invited", "disabled"];

export async function createUserAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const role = oneOf(formData.get("role"), ROLES);
    if (!role) return { ok: false, error: "Pick a role.", fields: { role: "Pick a role" } };

    const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
    const confirm = typeof formData.get("confirmPassword") === "string" ? String(formData.get("confirmPassword")) : "";
    if (password && password !== confirm) {
      return { ok: false, error: "The passwords don't match.", fields: { confirmPassword: "Doesn't match the password" } };
    }

    const name = formText(formData.get("name"));
    await UserService.create(
      {
        name,
        email: formText(formData.get("email")),
        role,
        siteId: optionalText(formData.get("siteId")),
        password: password || undefined,
      },
      actor
    );
    return {
      ok: true,
      message: password
        ? `${name} can sign in now.`
        : `${name} is invited. Set a password from the ⋯ menu before they sign in.`,
    };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function updateUserProfileAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    await UserService.updateProfile(
      formText(formData.get("id")),
      { name: formText(formData.get("name")), email: formText(formData.get("email")) },
      actor
    );
    return { ok: true, message: "Changes saved." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function changeUserRoleAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const role = oneOf(formData.get("role"), ROLES);
    if (!role) return { ok: false, error: "Pick a role.", fields: { role: "Pick a role" } };

    await UserService.changeRole(formText(formData.get("id")), { role, siteId: optionalText(formData.get("siteId")) }, actor);
    return { ok: true, message: "The change applies the next time they sign in." };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function setUserStatusAction(input: { id: string; status: AccountStatus }): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const status = oneOf(input?.status, STATUSES);
    if (!status) return { ok: false, error: "Pick a status." };

    await UserService.setStatus(String(input.id), status, actor);
    return {
      ok: true,
      message: status === "disabled" ? "They can no longer sign in. Their records are kept." : "They can sign in again.",
    };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function setUserPasswordAction(formData: FormData): Promise<ActionState> {
  try {
    const actor = await SessionService.requireUser();
    const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
    const confirm = typeof formData.get("confirmPassword") === "string" ? String(formData.get("confirmPassword")) : "";
    if (password !== confirm) {
      return { ok: false, error: "The passwords don't match.", fields: { confirmPassword: "Doesn't match the password" } };
    }

    await UserService.setPassword(formText(formData.get("id")), password, actor);
    return { ok: true, message: "Share it with them securely. Invited accounts are now active." };
  } catch (error) {
    return toErrorState(error);
  }
}
