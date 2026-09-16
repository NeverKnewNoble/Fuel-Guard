import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { equipment, sites, tanks } from "@/db/schema";
import type { CreateSiteInput, SiteOption, SiteRow, SiteUsageRow, UpdateSiteInput } from "@/types/site";
import type { Actor } from "@/types/user";
import { AUDIT_ACTIONS, AuditLogService } from "./auditLogService";
import { ConflictError, NotFoundError, isUniqueViolation, throwIfInvalid } from "./errors";
import { SessionService } from "./sessionService";

export class SiteService {
  static async list(options: { includeArchived?: boolean } = {}): Promise<SiteOption[]> {
    return db.query.sites.findMany({
      columns: { id: true, code: true, name: true, region: true },
      where: options.includeArchived ? undefined : { archivedAt: { isNull: true } },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Every site with what's based there, for the Sites page. The counts are what `archive` checks,
   * so an admin can see why a site can't be archived yet.
   */
  static async listWithUsage(options: { includeArchived?: boolean } = {}): Promise<SiteUsageRow[]> {
    const rows = await db
      .select({
        id: sites.id,
        code: sites.code,
        name: sites.name,
        region: sites.region,
        archivedAt: sites.archivedAt,
        equipmentCount: sql<number>`count(distinct ${equipment.id}) filter (where ${equipment.status} <> 'retired')`.mapWith(Number),
        tankCount: sql<number>`count(distinct ${tanks.id}) filter (where ${tanks.archivedAt} is null)`.mapWith(Number),
      })
      .from(sites)
      .leftJoin(equipment, eq(equipment.siteId, sites.id))
      .leftJoin(tanks, eq(tanks.siteId, sites.id))
      .where(options.includeArchived ? undefined : isNull(sites.archivedAt))
      .groupBy(sites.id)
      .orderBy(asc(sites.name));
    return rows;
  }

  static async getById(id: string): Promise<SiteRow> {
    const site = await db.query.sites.findFirst({ where: { id } });
    if (!site) throw new NotFoundError("Site");
    return site;
  }

  /** For forms that assign records to a site: the site must exist and not be archived. */
  static async assertActive(id: string, field = "siteId"): Promise<SiteRow> {
    const site = await db.query.sites.findFirst({ where: { id } });
    if (!site || site.archivedAt) throwIfInvalid({ [field]: "Pick a site" });
    return site!;
  }

  static async create(input: CreateSiteInput, actor: Actor): Promise<{ id: string; code: string }> {
    SessionService.assertAdmin(actor);

    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const region = input.region?.trim() || null;

    const fields: Record<string, string> = {};
    if (!code) fields.code = "Enter a site code";
    if (!name) fields.name = "Enter a site name";
    throwIfInvalid(fields);

    const id = crypto.randomUUID();
    try {
      const [[created]] = await db.batch([
        db.insert(sites).values({ id, code, name, region }).returning({ id: sites.id, code: sites.code }),
        AuditLogService.entry(actor.id, AUDIT_ACTIONS.siteCreate, "sites", id, null, { code, name, region }),
      ]);
      return created;
    } catch (error) {
      if (isUniqueViolation(error, "sites_code_key")) throw new ConflictError("Site code already used.");
      throw error;
    }
  }

  static async update(id: string, input: UpdateSiteInput, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const site = await SiteService.getById(id);

    const changes: { name?: string; region?: string | null } = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      throwIfInvalid(name ? {} : { name: "Enter a site name" });
      if (name !== site.name) changes.name = name;
    }
    if (input.region !== undefined) {
      const region = input.region?.trim() || null;
      if (region !== site.region) changes.region = region;
    }
    if (Object.keys(changes).length === 0) return;

    const before = { name: site.name, region: site.region };
    await db.batch([
      db.update(sites).set(changes).where(eq(sites.id, id)),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.siteUpdate, "sites", id, before, { ...before, ...changes }),
    ]);
  }

  /** Sites are archived, never deleted. Refused while equipment or tankers still belong to the site. */
  static async archive(id: string, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const site = await SiteService.getById(id);
    if (site.archivedAt) return;

    const [equipmentCount, tankCount] = await Promise.all([
      db.$count(equipment, and(eq(equipment.siteId, id), ne(equipment.status, "retired"))),
      db.$count(tanks, and(eq(tanks.siteId, id), isNull(tanks.archivedAt))),
    ]);
    if (equipmentCount > 0 || tankCount > 0) {
      const parts = [
        equipmentCount > 0 ? `${equipmentCount} equipment unit${equipmentCount === 1 ? "" : "s"}` : null,
        tankCount > 0 ? `${tankCount} tanker${tankCount === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      throw new ConflictError(`${site.name} still has ${parts.join(" and ")}. Move them to another site first.`);
    }

    const archivedAt = new Date();
    await db.batch([
      db.update(sites).set({ archivedAt }).where(eq(sites.id, id)),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.siteArchive, "sites", id, { archivedAt: null }, { archivedAt }),
    ]);
  }
}
