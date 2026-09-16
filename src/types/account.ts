import type { AppUserRole } from "@/types/next-auth";
import type { UserRole } from "@/types/user";

export type AccountStatus = "active" | "invited" | "disabled";

/** One row of the Users & Roles → Accounts table. Never includes `passwordHash`. */
export type AccountRow = {
  id: string;
  code: string;
  name: string;
  email: string;
  role: AppUserRole;
  roleLabel: string;
  status: AccountStatus;
  siteId: string | null;
  /** "All sites" when `siteId` is null. */
  siteName: string;
  lastActiveAt: Date | null;
};

export type AccountFilters = { role?: AppUserRole; status?: AccountStatus; siteId?: string; search?: string };

/** Users & Roles stat tiles. */
export type AccountStats = { administrators: number; recordsTakers: number; active: number; total: number };

export type CreateUserInput = { name: string; email: string; role: AppUserRole; siteId: string | null; password?: string };

export type UpdateProfileInput = { name?: string; email?: string };

export type ChangeRoleInput = { role: AppUserRole; siteId: string | null };
