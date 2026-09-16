"use server";

import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { homeFor, isAdminPath, LOGIN_PATH, safeCallbackUrl } from "@/utils/authRoutes";
import { setFlash } from "@/utils/setFlash";

export type LoginState = { error: string; email: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email address and password.", email };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          error.type === "CredentialsSignin"
            ? "Incorrect email or password."
            : "We couldn't sign you in. Please try again.",
        email,
      };
    }
    throw error;
  }

  // A redirect from a server action renders the target without passing through
  // proxy, so pick a destination the user's role can actually open.
  const [user] = await db
    .select({ role: users.role, name: users.name })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));
  const canOpenCallback =
    callbackUrl &&
    (user?.role === "administrator" || !isAdminPath(new URL(callbackUrl, "http://localhost").pathname));

  await setFlash({
    type: "success",
    message: user ? `Welcome back, ${user.name.split(" ")[0]}` : "Signed in",
    description: "You're signed in to FuelGuard.",
  });

  redirect(canOpenCallback ? callbackUrl : user ? homeFor(user.role) : "/portal");
}

export async function logout() {
  // Set before signOut: it redirects by throwing, and the cookie rides along on that response.
  await setFlash({ type: "success", message: "You've been signed out", description: "See you next time." });
  await signOut({ redirectTo: LOGIN_PATH });
}
