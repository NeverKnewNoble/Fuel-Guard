import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { operators } from "@/db/schema";
import type { CreateOperatorInput, OperatorOption, OperatorRow, UpdateOperatorInput } from "@/types/operator";
import type { Actor } from "@/types/user";
import { ConflictError, NotFoundError, isUniqueViolation, throwIfInvalid } from "./errors";
import { SessionService } from "./sessionService";
import { SiteService } from "./siteService";

const USER_CONSTRAINT = "operators_user_id_key";
const userTaken = () => new ConflictError("That user was linked to another operator at the same moment. Try again.");

/** Operators are the people who drive or run equipment. They are deactivated, never deleted, because fuel entries point at them. */
export class OperatorService {
  /** With `siteId`, returns that site's operators plus those who work at any site. */
  static async listActive(options: { siteId?: string | null } = {}): Promise<OperatorOption[]> {
    const rows = await db.query.operators.findMany({
      columns: { id: true, name: true, phone: true, siteId: true },
      with: { site: { columns: { name: true } } },
      where: {
        isActive: true,
        ...(options.siteId ? { OR: [{ siteId: options.siteId }, { siteId: { isNull: true } }] } : {}),
      },
      orderBy: { name: "asc" },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, siteId: r.siteId, siteName: r.site?.name ?? null }));
  }

  /** Everyone on the Operators page, including deactivated people and who they're linked to. */
  static async list(options: { includeInactive?: boolean } = {}): Promise<OperatorRow[]> {
    const rows = await db.query.operators.findMany({
      columns: { id: true, name: true, phone: true, siteId: true, userId: true, isActive: true },
      with: { site: { columns: { name: true } }, user: { columns: { name: true } } },
      where: options.includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      siteId: r.siteId,
      siteName: r.site?.name ?? null,
      userId: r.userId,
      userName: r.user?.name ?? null,
      isActive: r.isActive,
    }));
  }

  static async getById(id: string) {
    const operator = await db.query.operators.findFirst({ where: { id } });
    if (!operator) throw new NotFoundError("Operator");
    return operator;
  }

  static async create(input: CreateOperatorInput, actor: Actor): Promise<{ id: string }> {
    SessionService.assertAdmin(actor);

    const name = input.name.trim();
    throwIfInvalid(name ? {} : { name: "Enter the operator's name" });
    const siteId = input.siteId || null;
    const userId = input.userId || null;

    if (siteId) await SiteService.assertActive(siteId);
    if (userId) await assertUserExists(userId);

    const id = crypto.randomUUID();
    const insert = db
      .insert(operators)
      .values({ id, name, phone: input.phone?.trim() || null, siteId, userId })
      .returning({ id: operators.id });

    try {
      if (!userId) return (await insert)[0];
      const [, [created]] = await db.batch([releaseUser(userId, id), insert]);
      return created;
    } catch (error) {
      if (isUniqueViolation(error, USER_CONSTRAINT)) throw userTaken();
      throw error;
    }
  }

  static async update(id: string, input: UpdateOperatorInput, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    await OperatorService.getById(id);

    const changes: { name?: string; phone?: string | null; siteId?: string | null } = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      throwIfInvalid(name ? {} : { name: "Enter the operator's name" });
      changes.name = name;
    }
    if (input.phone !== undefined) changes.phone = input.phone?.trim() || null;
    if (input.siteId !== undefined) {
      changes.siteId = input.siteId || null;
      if (changes.siteId) await SiteService.assertActive(changes.siteId);
    }
    if (Object.keys(changes).length === 0) return;

    await db.update(operators).set(changes).where(eq(operators.id, id));
  }

  /** Past fuel entries keep pointing at the operator, which is why they're never deleted. */
  static async setActive(id: string, isActive: boolean, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const updated = await db.update(operators).set({ isActive }).where(eq(operators.id, id)).returning({ id: operators.id });
    if (updated.length === 0) throw new NotFoundError("Operator");
  }

  static async deactivate(id: string, actor: Actor): Promise<void> {
    return OperatorService.setActive(id, false, actor);
  }

  /**
   * Links the operator to a portal user account, or clears the link with `null`. An account belongs
   * to one operator at a time, so one already linked elsewhere is moved here.
   */
  static async linkUser(operatorId: string, userId: string | null, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    await OperatorService.getById(operatorId);

    const link = db.update(operators).set({ userId }).where(eq(operators.id, operatorId));
    try {
      if (!userId) {
        await link;
        return;
      }
      await assertUserExists(userId);
      await db.batch([releaseUser(userId, operatorId), link]);
    } catch (error) {
      if (isUniqueViolation(error, USER_CONSTRAINT)) throw userTaken();
      throw error;
    }
  }
}

async function assertUserExists(userId: string) {
  const user = await db.query.users.findFirst({ columns: { id: true }, where: { id: userId } });
  if (!user) throw new NotFoundError("User");
}

/** Unlinks the account from whichever other operator holds it; batched with the new link so both land together. */
const releaseUser = (userId: string, operatorId: string) =>
  db.update(operators).set({ userId: null }).where(and(eq(operators.userId, userId), ne(operators.id, operatorId)));
