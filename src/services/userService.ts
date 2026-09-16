import { compare, hash } from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type {
  AccountFilters,
  AccountRow,
  AccountStats,
  AccountStatus,
  ChangeRoleInput,
  CreateUserInput,
  UpdateProfileInput,
} from "@/types/account";
import type { Actor, UserRow } from "@/types/user";
import { roleLabels } from "@/utils/authRoutes";
import { AUDIT_ACTIONS, AuditLogService } from "./auditLogService";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, isUniqueViolation } from "./errors";
import { SessionService } from "@/services/sessionService";
import { toCount } from "./utils";


const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_CONSTRAINT = "users_email_lower_key";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


export class UserService {
  static async listAccounts(filters: AccountFilters = {}): Promise<AccountRow[]> {
    const term = filters.search?.trim();
    const rows = await db.query.users.findMany({
      columns: { passwordHash: false },
      with: { site: true },
      where: {
        role: filters.role,
        status: filters.status,
        siteId: filters.siteId,
        ...(term ? { OR: [{ name: { ilike: `%${term}%` } }, { email: { ilike: `%${term}%` } }] } : {}),
      },
      orderBy: { name: "asc" },
    });
    return rows.map(toAccountRow);
  }

  static async getStats(): Promise<AccountStats> {
    const [row] = await db
      .select({
        administrators: sql`count(*) filter (where ${users.role} = 'administrator')`,
        recordsTakers: sql`count(*) filter (where ${users.role} = 'records_taker')`,
        active: sql`count(*) filter (where ${users.status} = 'active')`,
        total: sql`count(*)`,
      })
      .from(users);
    return {
      administrators: toCount(row?.administrators),
      recordsTakers: toCount(row?.recordsTakers),
      active: toCount(row?.active),
      total: toCount(row?.total),
    };
  }

  static async getById(id: string): Promise<AccountRow> {
    const row = await db.query.users.findFirst({
      columns: { passwordHash: false },
      with: { site: true },
      where: { id },
    });
    if (!row) throw new NotFoundError("User");
    return toAccountRow(row);
  }

  /** Includes `passwordHash` — internal use only, never return this to a page. */
  static async findByEmail(email: string) {
    return db.query.users.findFirst({
      where: { RAW: (t) => sql`lower(${t.email}) = lower(${email.trim()})` },
    });
  }

  /** Returns the same `null` for "no user", "wrong password" and "not active", so sign-in can't reveal which accounts exist. */
  static async verifyCredentials(email: string, password: string): Promise<(Actor & { name: string; email: string }) | null> {
    if (!email.trim() || !password) return null;

    const user = await UserService.findByEmail(email);
    if (!user || user.status !== "active" || !user.passwordHash) return null;
    if (!(await compare(password, user.passwordHash))) return null;

    await UserService.touchLastActive(user.id);
    return { id: user.id, name: user.name, email: user.email, role: user.role, siteId: user.siteId };
  }

  static async create(input: CreateUserInput, actor: Actor): Promise<{ id: string; code: string }> {
    SessionService.assertAdmin(actor);

    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const siteId = input.siteId || null;

    const fields: Record<string, string> = {};
    if (!name) fields.name = "Enter a name";
    if (!EMAIL_PATTERN.test(email)) fields.email = "Enter a valid email address";
    if (input.role === "records_taker" && !siteId) fields.siteId = "Pick a site";
    if (input.password !== undefined && input.password !== "") {
      const passwordError = checkPassword(input.password);
      if (passwordError) fields.password = passwordError;
    }
    throwIfInvalid(fields);

    if (await UserService.findByEmail(email)) throw emailTaken();

    const id = crypto.randomUUID();
    const password = input.password || undefined;
    const status: AccountStatus = password ? "active" : "invited";
    const passwordHash = password ? await hash(password, BCRYPT_ROUNDS) : null;

    try {
      const [[created]] = await db.batch([
        db
          .insert(users)
          .values({ id, name, email, role: input.role, siteId, status, passwordHash, invitedBy: actor.id })
          .returning({ id: users.id, code: users.code }),
        AuditLogService.entry(actor.id, AUDIT_ACTIONS.userCreate, "users", id, null, { name, email, role: input.role, siteId, status }),
      ]);
      return created;
    } catch (error) {
      if (isUniqueViolation(error, EMAIL_CONSTRAINT)) throw emailTaken();
      throw error;
    }
  }

  /** Admin, or the user editing themselves. */
  static async updateProfile(userId: string, input: UpdateProfileInput, actor: Actor): Promise<void> {
    assertAdminOrSelf(actor, userId);
    const user = await loadUser(userId);

    const changes: UpdateProfileInput = {};
    const fields: Record<string, string> = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) fields.name = "Enter a name";
      else if (name !== user.name) changes.name = name;
    }
    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email)) fields.email = "Enter a valid email address";
      else if (email !== user.email.toLowerCase()) changes.email = email;
    }
    throwIfInvalid(fields);
    if (Object.keys(changes).length === 0) return;

    if (changes.email) {
      const existing = await UserService.findByEmail(changes.email);
      if (existing && existing.id !== userId) throw emailTaken();
    }

    const before = { name: user.name, email: user.email };
    try {
      await db.batch([
        db.update(users).set(changes).where(eq(users.id, userId)),
        AuditLogService.entry(actor.id, AUDIT_ACTIONS.userUpdate, "users", userId, before, { ...before, ...changes }),
      ]);
    } catch (error) {
      if (isUniqueViolation(error, EMAIL_CONSTRAINT)) throw emailTaken();
      throw error;
    }
  }

  /** The user's current session keeps the old role until they sign in again — say so in the UI message. */
  static async changeRole(userId: string, input: ChangeRoleInput, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const user = await loadUser(userId);

    const siteId = input.siteId || null;
    if (input.role === "records_taker" && !siteId) throw new ValidationError("Records takers need a site.", { siteId: "Pick a site" });
    if (user.role === input.role && user.siteId === siteId) return;

    if (user.role === "administrator" && input.role !== "administrator") await assertNotLastActiveAdmin(user);

    await db.batch([
      db.update(users).set({ role: input.role, siteId }).where(eq(users.id, userId)),
      AuditLogService.entry(
        actor.id,
        AUDIT_ACTIONS.userRoleChange,
        "users",
        userId,
        { role: user.role, siteId: user.siteId },
        { role: input.role, siteId }
      ),
    ]);
  }

  /** Users are never deleted — too many records point at them. Disabling blocks sign-in. */
  static async setStatus(userId: string, status: AccountStatus, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    if (userId === actor.id && status !== "active") throw new ConflictError("You can't disable your own account.");

    const user = await loadUser(userId);
    if (user.status === status) return;

    if (user.role === "administrator" && status !== "active") await assertNotLastActiveAdmin(user);

    await db.batch([
      db.update(users).set({ status }).where(eq(users.id, userId)),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.userStatusChange, "users", userId, { status: user.status }, { status }),
    ]);
  }

  /** Admin, or the user changing their own password. Activates an invited account. */
  static async setPassword(userId: string, newPassword: string, actor: Actor): Promise<void> {
    assertAdminOrSelf(actor, userId);

    const passwordError = checkPassword(newPassword);
    if (passwordError) throw new ValidationError(passwordError, { password: passwordError });

    const user = await loadUser(userId);
    const passwordHash = await hash(newPassword, BCRYPT_ROUNDS);
    const status: AccountStatus = user.status === "invited" ? "active" : user.status;

    await db.batch([
      db.update(users).set({ passwordHash, status }).where(eq(users.id, userId)),
      // Never log the hash.
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.userPasswordSet, "users", userId, { status: user.status }, { status }),
    ]);
  }

  static async touchLastActive(userId: string): Promise<void> {
    await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId));
  }
}

function toAccountRow(row: Omit<UserRow, "passwordHash"> & { site: { name: string } | null }): AccountRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    email: row.email,
    role: row.role,
    roleLabel: roleLabels[row.role],
    status: row.status,
    siteId: row.siteId,
    siteName: row.site?.name ?? "All sites",
    lastActiveAt: row.lastActiveAt,
  };
}

async function loadUser(id: string) {
  const user = await db.query.users.findFirst({ columns: { passwordHash: false }, where: { id } });
  if (!user) throw new NotFoundError("User");
  return user;
}

function assertAdminOrSelf(actor: Actor, userId: string) {
  if (actor.role !== "administrator" && actor.id !== userId) throw new ForbiddenError();
}

/** Only matters when the user is currently an active administrator; otherwise they aren't counted. */
async function assertNotLastActiveAdmin(user: Pick<UserRow, "role" | "status">) {
  if (user.role !== "administrator" || user.status !== "active") return;
  const activeAdmins = await db.$count(users, and(eq(users.role, "administrator"), eq(users.status, "active")));
  if (activeAdmins <= 1) throw new ConflictError("There must be at least one active administrator.");
}

function checkPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  return null;
}

function throwIfInvalid(fields: Record<string, string>) {
  const messages = Object.values(fields);
  if (messages.length > 0) throw new ValidationError(messages[0], fields);
}

const emailTaken = () => new ConflictError("An account with that email already exists.");
