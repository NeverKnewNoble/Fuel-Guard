import { db } from "@/db";
import { alertThresholds } from "@/db/schema";
import type { AlertSeverity } from "@/types/alerts";
import type { AlertThreshold, ThresholdLevel, ThresholdMap } from "@/types/standards";
import type { Actor } from "@/types/user";

import { AUDIT_ACTIONS, AuditLogService, SETTINGS_ENTITY_ID } from "./auditLogService";
import { ServiceError, throwIfInvalid } from "./errors";
import { SessionService } from "./sessionService";
import { toNumeric } from "./utils";

const LEVELS: ThresholdLevel[] = ["watch", "high", "critical"];

const LABELS: Record<ThresholdLevel, string> = {
  watch: "Watch",
  high: "High / flagged",
  critical: "Critical",
};

export class AlertThresholdService {
  /** Ordered watch → high → critical. */
  static async list(): Promise<AlertThreshold[]> {
    const rows = await db.select({ level: alertThresholds.level, percent: alertThresholds.percent }).from(alertThresholds);
    return LEVELS.map((level) => {
      const row = rows.find((r) => r.level === level);
      if (!row) throw new ServiceError("Alert thresholds are not set up — run the seed script.");
      return { level, label: LABELS[level], percent: Number(row.percent) };
    });
  }

  /** Like `list`, but `null` instead of an error when the thresholds haven't been set up, so a page can offer to set them. */
  static async listIfConfigured(): Promise<AlertThreshold[] | null> {
    try {
      return await AlertThresholdService.list();
    } catch (error) {
      if (error instanceof ServiceError && error.code === "SERVICE_ERROR") return null;
      throw error;
    }
  }

  static async getMap(): Promise<ThresholdMap> {
    const list = await AlertThresholdService.list();
    return Object.fromEntries(list.map((t) => [t.level, t.percent])) as ThresholdMap;
  }

  static async update(input: ThresholdMap, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);

    // A database check can't compare rows, so the ordering rule lives only here.
    const fields: Record<string, string> = {};
    for (const level of LEVELS) {
      const value = input[level];
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) fields[level] = "Must be above 0";
    }
    if (!fields.watch && !fields.high && input.high <= input.watch) fields.high = "Must be above Watch";
    if (!fields.high && !fields.critical && input.critical <= input.high) fields.critical = "Must be above High";
    throwIfInvalid(fields);

    const before = await db
      .select({ level: alertThresholds.level, percent: alertThresholds.percent })
      .from(alertThresholds)
      .then((rows) => Object.fromEntries(rows.map((r) => [r.level, Number(r.percent)])));

    const updatedAt = new Date();
    const upsert = (level: ThresholdLevel) => {
      const percent = toNumeric(input[level]);
      return db
        .insert(alertThresholds)
        .values({ level, percent, updatedBy: actor.id })
        .onConflictDoUpdate({ target: alertThresholds.level, set: { percent, updatedBy: actor.id, updatedAt } });
    };

    await db.batch([
      upsert("watch"),
      upsert("high"),
      upsert("critical"),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.thresholdUpdate, "alert_thresholds", SETTINGS_ENTITY_ID, before, {
        watch: input.watch,
        high: input.high,
        critical: input.critical,
      }),
    ]);
  }

  /** Pure. The highest severity whose threshold `variancePct` reaches, or `null`. */
  static severityFor(variancePct: number, thresholds: ThresholdMap): AlertSeverity | null {
    if (variancePct >= thresholds.critical) return "critical";
    if (variancePct >= thresholds.high) return "high";
    if (variancePct >= thresholds.watch) return "watch";
    return null;
  }
}
