import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homeFor, LOGIN_PATH } from "@/utils/authRoutes";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect(LOGIN_PATH);
  if (session.user.role !== "administrator") redirect(homeFor(session.user.role));

  return children;
}
