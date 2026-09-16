import { auth } from "@/auth";
import { ForbiddenError, UnauthorizedError } from "@/services/errors";
import type { Actor } from "@/types/user";

export class SessionService {
  /** The signed-in user from the NextAuth session, or `null` when not signed in. */
  static async getActor(): Promise<Actor | null> {
    const session = await auth();
    const user = session?.user;
    if (!user?.id) return null;
    return { id: user.id, role: user.role, siteId: user.siteId ?? null };
  }

  /** Call this first in every server action. */
  static async requireUser(): Promise<Actor> {
    const actor = await SessionService.getActor();
    if (!actor) throw new UnauthorizedError();
    return actor;
  }

  static async requireAdmin(): Promise<Actor> {
    const actor = await SessionService.requireUser();
    SessionService.assertAdmin(actor);
    return actor;
  }

  static isAdmin(actor: Actor): boolean {
    return actor.role === "administrator";
  }

  /** Services call this at the top of admin-only methods. */
  static assertAdmin(actor: Actor): void {
    if (actor.role !== "administrator") throw new ForbiddenError();
  }

  /** Admins and actors with no site ("All sites") can access any site. */
  static canAccessSite(actor: Actor, siteId: string | null): boolean {
    return actor.role === "administrator" || actor.siteId === null || actor.siteId === siteId;
  }

  static assertSiteAccess(actor: Actor, siteId: string | null): void {
    if (!SessionService.canAccessSite(actor, siteId)) {
      throw new ForbiddenError("That record belongs to another site.");
    }
  }
}
