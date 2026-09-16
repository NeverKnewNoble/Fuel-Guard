import type { users } from "@/db/schema";
import type { AppUserRole } from "@/types/next-auth";

export type UserRole = "Administrator" | "Records Taker";

export type DemoUser = {
  role: UserRole;
  name: string;
  email: string;
};

/** The signed-in user (`session.user` from NextAuth). Passed as the last argument to any service method that changes data or depends on who is asking. */
export type Actor = { id: string; role: AppUserRole; siteId: string | null };

/** The signed-in user as a client component sees them: the actor plus their default site's name. */
export type CurrentUser = Actor & { siteName: string | null };

/** A `users` row as a select returns it. Includes `passwordHash` — keep it inside services. */
export type UserRow = typeof users.$inferSelect;
