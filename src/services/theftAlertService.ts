import { type SQL, and, desc, eq, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { alertReads, equipment, equipmentTypes, sites, theftAlerts } from "@/db/schema";
import type { AlertCounts, AlertDetail, AlertListOptions, AlertRow, AlertSeverity, WatchlistItem } from "@/types/alerts";
import type { Actor } from "@/types/user";
import { AUDIT_ACTIONS, AuditLogService } from "./auditLogService";
import { ConflictError, NotFoundError, throwIfInvalid } from "./errors";
import { SessionService } from "./sessionService";
import { inAccraMonth, monthStart, toNumber } from "./utils";

const unresolved = ne(theftAlerts.state, "resolved");

/** Replaces the in-browser `src/utils/alertReadStore.ts`, which resets on refresh. */
export class TheftAlertService {
  /** Alert queue, newest first, with this user's read state. */
  static async list(options: AlertListOptions): Promise<AlertRow[]> {
    const conditions: (SQL | undefined)[] = [
      options.state ? eq(theftAlerts.state, options.state) : undefined,
      options.severity ? eq(theftAlerts.severity, options.severity) : undefined,
      options.siteId ? eq(theftAlerts.siteId, options.siteId) : undefined,
      options.before ? lt(theftAlerts.detectedAt, options.before) : undefined,
    ];

    const rows = await db
      .select({
        id: theftAlerts.id,
        code: theftAlerts.code,
        equipmentId: theftAlerts.equipmentId,
        equipmentCode: equipment.code,
        equipmentName: equipmentTypes.name,
        siteName: sites.name,
        rule: theftAlerts.rule,
        severity: theftAlerts.severity,
        state: theftAlerts.state,
        variancePct: theftAlerts.variancePct,
        summary: theftAlerts.summary,
        detectedAt: theftAlerts.detectedAt,
        isRead: sql<boolean>`${alertReads.alertId} is not null`,
      })
      .from(theftAlerts)
      .innerJoin(equipment, eq(equipment.id, theftAlerts.equipmentId))
      .innerJoin(equipmentTypes, eq(equipmentTypes.id, equipment.equipmentTypeId))
      .innerJoin(sites, eq(sites.id, theftAlerts.siteId))
      .leftJoin(alertReads, and(eq(alertReads.alertId, theftAlerts.id), eq(alertReads.userId, options.userId)))
      .where(and(...conditions))
      .orderBy(desc(theftAlerts.detectedAt))
      .limit(options.limit ?? 50);

    return rows.map((r) => ({
      ...r,
      variancePct: toNumber(r.variancePct),
      isRead: Boolean(r.isRead) || r.state === "resolved",
    }));
  }

  /** Stat tiles; the Dashboard "Flagged anomalies" tile uses `open`. */
  static async getCounts(): Promise<AlertCounts> {
    const openWithSeverity = (severity: AlertSeverity) =>
      sql<number>`count(*) filter (where ${theftAlerts.severity} = ${severity} and ${unresolved})`.mapWith(Number);
    const [row] = await db
      .select({
        critical: openWithSeverity("critical"),
        high: openWithSeverity("high"),
        watch: openWithSeverity("watch"),
        resolvedThisMonth: sql<number>`count(*) filter (where ${theftAlerts.state} = 'resolved' and ${inAccraMonth(theftAlerts.resolvedAt, monthStart())})`.mapWith(Number),
        open: sql<number>`count(*) filter (where ${unresolved})`.mapWith(Number),
      })
      .from(theftAlerts);
    return row ?? { critical: 0, high: 0, watch: 0, resolvedThisMonth: 0, open: 0 };
  }

  /** Sidebar badge and mobile menu dot: unresolved alerts this user hasn't read. */
  static async getUnreadCount(userId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(theftAlerts)
      .leftJoin(alertReads, and(eq(alertReads.alertId, theftAlerts.id), eq(alertReads.userId, userId)))
      .where(and(isNull(alertReads.alertId), unresolved));
    return row?.count ?? 0;
  }

  /** Opening an alert marks it as read. */
  static async getById(alertId: string, userId: string): Promise<AlertDetail> {
    const row = await db.query.theftAlerts.findFirst({
      where: { id: alertId },
      with: {
        equipment: { columns: { id: true, code: true, makeModel: true }, with: { type: { columns: { name: true } } } },
        site: { columns: { id: true, name: true } },
        resolver: { columns: { id: true, name: true } },
        fuelEntries: {
          columns: { id: true, code: true, dispensedAt: true, litres: true, status: true },
          with: { recorder: { columns: { name: true } } },
          orderBy: { dispensedAt: "desc" },
        },
      },
    });
    if (!row) throw new NotFoundError("Alert");

    await TheftAlertService.markAsRead(alertId, userId);

    return {
      id: row.id,
      code: row.code,
      rule: row.rule,
      severity: row.severity,
      state: row.state,
      variancePct: toNumber(row.variancePct),
      summary: row.summary,
      detectedAt: row.detectedAt,
      resolvedAt: row.resolvedAt,
      resolutionNote: row.resolutionNote,
      resolvedBy: row.resolver,
      equipment: { id: row.equipment.id, code: row.equipment.code, makeModel: row.equipment.makeModel, typeName: row.equipment.type.name },
      site: row.site,
      fuelEntries: row.fuelEntries.map((f) => ({
        id: f.id,
        code: f.code,
        dispensedAt: f.dispensedAt,
        litres: Number(f.litres),
        status: f.status,
        recordedBy: f.recorder.name,
      })),
    };
  }

  /** The action should then `revalidatePath("/portal", "layout")` so the sidebar badge updates. */
  static async markAsRead(alertId: string, userId: string): Promise<void> {
    await db.insert(alertReads).values({ alertId, userId }).onConflictDoNothing();
  }

  /** One statement for every unresolved alert. Revalidate the layout afterwards. */
  static async markAllAsRead(userId: string): Promise<void> {
    await db
      .insert(alertReads)
      .select(
        db
          .select({ alertId: theftAlerts.id, userId: sql<string>`${userId}::uuid`.as("user_id"), readAt: sql<Date>`now()`.as("read_at") })
          .from(theftAlerts)
          .where(unresolved)
      )
      .onConflictDoNothing();
  }

  static async markAsUnread(alertId: string, userId: string): Promise<void> {
    await db.delete(alertReads).where(and(eq(alertReads.alertId, alertId), eq(alertReads.userId, userId)));
  }

  static async startReview(alertId: string, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const alert = await loadState(alertId);
    if (alert.state !== "open") throw new ConflictError("Only open alerts can be put under review.");
    await db.update(theftAlerts).set({ state: "reviewing" }).where(eq(theftAlerts.id, alertId));
  }

  /** Records who cleared the alert and why. */
  static async resolve(alertId: string, note: string, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const resolutionNote = note.trim();
    throwIfInvalid(resolutionNote ? {} : { note: "Add a note explaining the outcome" });

    const alert = await loadState(alertId);
    if (alert.state === "resolved") throw new ConflictError("This alert is already resolved.");

    await db.batch([
      // The check constraint needs resolvedBy and resolvedAt set together.
      db
        .update(theftAlerts)
        .set({ state: "resolved", resolvedBy: actor.id, resolvedAt: new Date(), resolutionNote })
        .where(eq(theftAlerts.id, alertId)),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.alertResolve, "theft_alerts", alertId, { state: alert.state }, {
        state: "resolved",
        note: resolutionNote,
      }),
    ]);
  }

  static async reopen(alertId: string, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const alert = await loadState(alertId);
    if (alert.state !== "resolved") throw new ConflictError("Only resolved alerts can be reopened.");

    await db.batch([
      db
        .update(theftAlerts)
        .set({ state: "open", resolvedBy: null, resolvedAt: null, resolutionNote: null })
        .where(eq(theftAlerts.id, alertId)),
      AuditLogService.entry(
        actor.id,
        AUDIT_ACTIONS.alertReopen,
        "theft_alerts",
        alertId,
        { state: "resolved", resolvedBy: alert.resolvedBy, note: alert.resolutionNote },
        { state: "open" }
      ),
    ]);
  }

  /** Dashboard → Anomaly watchlist: the most severe unresolved alert per equipment, most severe first. */
  static async getWatchlist(limit = 5): Promise<WatchlistItem[]> {
    const severityRank = sql`case ${theftAlerts.severity} when 'critical' then 0 when 'high' then 1 else 2 end`;
    const rows = await db
      .select({
        id: theftAlerts.id,
        equipmentId: theftAlerts.equipmentId,
        equipmentCode: equipment.code,
        equipmentName: equipmentTypes.name,
        severity: theftAlerts.severity,
      })
      .from(theftAlerts)
      .innerJoin(equipment, eq(equipment.id, theftAlerts.equipmentId))
      .innerJoin(equipmentTypes, eq(equipmentTypes.id, equipment.equipmentTypeId))
      .where(unresolved)
      .orderBy(severityRank, desc(theftAlerts.detectedAt));

    const seen = new Set<string>();
    const items: WatchlistItem[] = [];
    for (const row of rows) {
      if (seen.has(row.equipmentId)) continue;
      seen.add(row.equipmentId);
      items.push(row);
      if (items.length === limit) break;
    }
    return items;
  }
}

async function loadState(alertId: string) {
  const alert = await db.query.theftAlerts.findFirst({
    columns: { state: true, resolvedBy: true, resolutionNote: true },
    where: { id: alertId },
  });
  if (!alert) throw new NotFoundError("Alert");
  return alert;
}
