import { type SQL, and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { sites, tankDips, tankIntakes, tankPeriodBalances, tanks, vTankLevels } from "@/db/schema";
import type { CreateTankInput, TankCardData, TankDetail, TankKind, TankOption, TankTotals, UpdateTankInput } from "@/types/tank";
import type { Actor } from "@/types/user";
import { fillPercent, levelOf } from "@/utils/tankUtils";
import { AUDIT_ACTIONS, AuditLogService } from "./auditLogService";
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation, throwIfInvalid } from "./errors";
import { ReportingPeriodService } from "./reportingPeriodService";
import { SessionService } from "./sessionService";
import { SiteService } from "./siteService";
import { TankDipService } from "./tankDipService";
import { type BatchWrites, formatLitres, isNonNegative, isPositive, toNumber, toNumeric } from "./utils";

const KINDS: TankKind[] = ["bulk", "mobile_bowser", "day_tank"];
const codeTaken = () => new ConflictError("That tanker ID is already used.");

export class TankService {
  static async listWithLevels(filters: { siteId?: string } = {}): Promise<TankCardData[]> {
    const rows = await db
      .select({
        id: vTankLevels.tankId,
        code: vTankLevels.tankCode,
        name: vTankLevels.name,
        siteId: vTankLevels.siteId,
        siteName: sites.name,
        capacityL: vTankLevels.capacityL,
        currentL: vTankLevels.currentL,
        measuredL: vTankLevels.measuredL,
        measuredAt: vTankLevels.measuredAt,
        sinceDipL: vTankLevels.sinceDipL,
        lastRefillAt: vTankLevels.lastRefillAt,
      })
      .from(vTankLevels)
      .innerJoin(sites, eq(sites.id, vTankLevels.siteId))
      .where(filters.siteId ? eq(vTankLevels.siteId, filters.siteId) : undefined)
      .orderBy(asc(vTankLevels.tankCode));

    return rows.map((r) => {
      const levels = { capacityL: Number(r.capacityL), currentL: Number(r.currentL) };
      return {
        ...r,
        ...levels,
        measuredL: toNumber(r.measuredL),
        sinceDipL: Number(r.sinceDipL),
        fillPct: Math.round(fillPercent(levels) * 10) / 10,
        level: levelOf(levels),
      };
    });
  }

  /** Tankers header: "22,140 L available across 7 tanks". */
  static async getTotals(): Promise<TankTotals> {
    const [row] = await db
      .select({
        totalAvailableL: sql<number>`coalesce(sum(${vTankLevels.currentL}), 0)`.mapWith(Number),
        tankCount: sql<number>`count(*)`.mapWith(Number),
      })
      .from(vTankLevels);
    return row ?? { totalAvailableL: 0, tankCount: 0 };
  }

  static async getById(id: string): Promise<TankDetail> {
    const row = await db.query.tanks.findFirst({
      where: { id },
      with: { site: { columns: { id: true, code: true, name: true } } },
    });
    if (!row) throw new NotFoundError("Tanker");
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      kind: row.kind,
      siteId: row.siteId,
      capacityL: Number(row.capacityL),
      archivedAt: row.archivedAt,
      site: row.site,
    };
  }

  /** Non-archived tanks for the fuel entry and intake selects ("Bulk Tanker A (7,250 L)"). */
  static async listForSelect(): Promise<TankOption[]> {
    const rows = await db
      .select({
        id: vTankLevels.tankId,
        code: vTankLevels.tankCode,
        name: vTankLevels.name,
        capacityL: vTankLevels.capacityL,
        currentL: vTankLevels.currentL,
        siteId: vTankLevels.siteId,
        siteName: sites.name,
      })
      .from(vTankLevels)
      .innerJoin(sites, eq(sites.id, vTankLevels.siteId))
      .orderBy(asc(vTankLevels.tankCode));
    return rows.map((r) => ({ ...r, capacityL: Number(r.capacityL), currentL: Number(r.currentL) }));
  }

  static async create(input: CreateTankInput, actor: Actor): Promise<{ id: string; code: string }> {
    SessionService.assertAdmin(actor);

    const name = input.name.trim();
    const openingL = input.openingL ?? null;
    const fields: Record<string, string> = {};
    if (!name) fields.name = "Enter a tanker name";
    if (!KINDS.includes(input.kind)) fields.kind = "Pick a tanker type";
    if (!isPositive(input.capacityL)) fields.capacityL = "Capacity must be above 0";
    if (openingL !== null) {
      if (!isNonNegative(openingL)) fields.openingL = "Opening level can't be negative";
      else if (isPositive(input.capacityL) && openingL > input.capacityL) fields.openingL = "Opening level can't be more than the capacity";
    }
    throwIfInvalid(fields);

    const [period] = await Promise.all([ReportingPeriodService.getCurrent(), SiteService.assertActive(input.siteId)]);

    const id = crypto.randomUUID();
    const code = input.code?.trim().toUpperCase() || undefined;
    const values = { name, kind: input.kind, siteId: input.siteId, capacityL: toNumeric(input.capacityL) };

    const writes: BatchWrites = [
      // Leave `code` out when it wasn't typed, so the sequence generates TNK-##.
      db.insert(tanks).values({ id, ...(code ? { code } : {}), ...values }).returning({ id: tanks.id, code: tanks.code }),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.tankCreate, "tanks", id, null, { code: code ?? null, ...values, openingL }),
    ];
    if (openingL !== null) {
      writes.push(
        db.insert(tankDips).values({
          tankId: id,
          measuredL: toNumeric(openingL),
          measuredAt: new Date(),
          recordedBy: actor.id,
          note: "Opening level",
        }),
        db.insert(tankPeriodBalances).values({ periodId: period.id, tankId: id, openingL: toNumeric(openingL) })
      );
    }

    try {
      const [[created]] = (await db.batch(writes)) as [{ id: string; code: string }[], ...unknown[]];
      return created;
    } catch (error) {
      if (isUniqueViolation(error, "tanks_code_key")) throw codeTaken();
      throw error;
    }
  }

  static async update(id: string, input: UpdateTankInput, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const current = await TankService.getById(id);

    const fields: Record<string, string> = {};
    const next = {
      code: input.code !== undefined ? input.code.trim().toUpperCase() || current.code : current.code,
      name: input.name !== undefined ? input.name.trim() : current.name,
      kind: input.kind ?? current.kind,
      siteId: input.siteId ?? current.siteId,
      capacityL: input.capacityL ?? current.capacityL,
    };
    if (!next.name) fields.name = "Enter a tanker name";
    if (!KINDS.includes(next.kind)) fields.kind = "Pick a tanker type";
    if (!isPositive(next.capacityL)) fields.capacityL = "Capacity must be above 0";
    else if (next.capacityL !== current.capacityL) {
      const latest = await TankDipService.latest(id);
      if (latest && next.capacityL < latest.measuredL) {
        fields.capacityL = `Capacity can't be below the current level (${formatLitres(latest.measuredL)} L)`;
      }
    }
    throwIfInvalid(fields);
    if (next.siteId !== current.siteId) await SiteService.assertActive(next.siteId);

    const before = { code: current.code, name: current.name, kind: current.kind, siteId: current.siteId, capacityL: current.capacityL };
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((key) => next[key] !== before[key]);
    if (changed.length === 0) return;

    const { capacityL, ...rest } = next;
    try {
      await db.batch([
        db.update(tanks).set({ ...rest, capacityL: toNumeric(capacityL) }).where(eq(tanks.id, id)),
        AuditLogService.entry(actor.id, AUDIT_ACTIONS.tankUpdate, "tanks", id, before, next),
      ]);
    } catch (error) {
      if (isUniqueViolation(error, "tanks_code_key")) throw codeTaken();
      throw error;
    }
  }

  static async archive(id: string, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const current = await TankService.getById(id);
    if (current.archivedAt) return;

    // The running level, so a delivery recorded after the last dip still counts as fuel in the tank.
    const [level] = await db.select({ currentL: vTankLevels.currentL }).from(vTankLevels).where(eq(vTankLevels.tankId, id));
    if (level && Number(level.currentL) > 0) throw new ConflictError("Empty or transfer the fuel first.");

    const archivedAt = new Date();
    await db.batch([
      db.update(tanks).set({ archivedAt }).where(eq(tanks.id, id)),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.tankArchive, "tanks", id, { archivedAt: null }, { archivedAt }),
    ]);
  }

  /** Cost snapshot for a fuel entry: this tank's newest delivery price, else the newest delivery across all tanks. */
  static async getLatestUnitCost(tankId: string): Promise<number> {
    // A voided delivery never happened, so it can't set the price fuel entries are costed at.
    const notVoided = sql`${tankIntakes.voidedAt} is null`;
    const newest = (where?: SQL) =>
      db
        .select({ costPerLitre: tankIntakes.costPerLitre })
        .from(tankIntakes)
        .where(where ? and(where, notVoided) : notVoided)
        .orderBy(desc(tankIntakes.receivedAt))
        .limit(1);

    const [forTank] = await newest(eq(tankIntakes.tankId, tankId));
    if (forTank) return Number(forTank.costPerLitre);

    const [any] = await newest();
    if (any) return Number(any.costPerLitre);

    throw new ValidationError("Record a fuel delivery before issuing fuel, so the cost can be calculated.");
  }
}
