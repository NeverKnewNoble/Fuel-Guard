import type { DefaultSession } from "next-auth";

import type { userRole } from "@/db/schema";

export type AppUserRole = (typeof userRole.enumValues)[number];

declare module "next-auth" {
  interface User {
    role: AppUserRole;
    /** Null means "All sites". */
    siteId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: AppUserRole;
      siteId: string | null;
    } & DefaultSession["user"];
  }
}

// next-auth v5 re-exports the JWT type from @auth/core, so augment it there.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: AppUserRole;
    siteId: string | null;
  }
}
