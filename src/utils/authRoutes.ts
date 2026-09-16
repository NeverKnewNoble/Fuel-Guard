import type { AppUserRole } from "@/types/next-auth";

export const LOGIN_PATH = "/auth/login";

/** Portal sections only administrators may open — everything under the (admin) route group. */
const ADMIN_PATHS = [
  "/portal/dashboard",
  "/portal/tankers",
  "/portal/monthly_summary",
  "/portal/theft_alerts",
  "/portal/equipment_and_vehicles",
  "/portal/consumption_standards",
  "/portal/users_and_roles",
  "/portal/sites",
  "/portal/operators",
];

export function isAdminPath(pathname: string) {
  return ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Where each role lands after signing in. */
export function homeFor(role: AppUserRole) {
  return role === "administrator" ? "/portal/dashboard" : "/portal/fuel_entry";
}

export const roleLabels: Record<AppUserRole, string> = {
  administrator: "Administrator",
  records_taker: "Records Taker",
};

/** Only allow same-origin portal paths, so a crafted link can't redirect off-site after login. */
export function safeCallbackUrl(value: unknown) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/portal") || value.startsWith("//")) return null;
  return value;
}
