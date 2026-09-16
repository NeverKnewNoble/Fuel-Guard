import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { homeFor, LOGIN_PATH } from "@/utils/authRoutes";

/** Post-login landing: send each role to its own home page. */
export default async function PortalIndex() {
  const session = await auth();
  redirect(session?.user ? homeFor(session.user.role) : LOGIN_PATH);
}
