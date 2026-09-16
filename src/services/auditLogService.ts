import { db } from "@/db";
import { auditLog } from "@/db/schema";

/** `audit_log.entity_id` is a non-null uuid; settings with no row id (alert thresholds) log against this. */
export const SETTINGS_ENTITY_ID = "00000000-0000-0000-0000-000000000000";

export const AUDIT_ACTIONS = {
  userCreate: "user.create", userUpdate: "user.update", userRoleChange: "user.role_change", userStatusChange: "user.status_change", userPasswordSet: "user.password_set",
  siteCreate: "site.create", siteUpdate: "site.update", siteArchive: "site.archive",
  standardCreate: "standard.create", standardUpdate: "standard.update", standardDelete: "standard.delete", thresholdUpdate: "threshold.update",
  equipmentCreate: "equipment.create", equipmentUpdate: "equipment.update", equipmentStatusChange: "equipment.status_change",
  tankCreate: "tank.create", tankUpdate: "tank.update", tankArchive: "tank.archive",
  intakeUpdate: "intake.update", intakeVoid: "intake.void", intakeRestore: "intake.restore",
  fuelEntryUpdate: "fuel_entry.update", fuelEntryVoid: "fuel_entry.void", fuelEntryRestore: "fuel_entry.restore",
  fuelEntryCorrect: "fuel_entry.correct", fuelEntryCorrectionRejected: "fuel_entry.correction_rejected",
  alertResolve: "alert.resolve", alertReopen: "alert.reopen",
  periodClose: "period.close", periodReopen: "period.reopen",
} as const;

export class AuditLogService {
  /** Returns the insert query without awaiting it, so it can go straight into a `db.batch([...])`. Never pass password hashes. */
  static entry(actorId: string | null, action: string, entityType: string, entityId: string, before: unknown, after: unknown) {
    return db.insert(auditLog).values({ actorId, action, entityType, entityId, before, after });
  }

  /** One-off logging outside a batch. */
  static async record(actorId: string | null, action: string, entityType: string, entityId: string, before: unknown, after: unknown): Promise<void> {
    await AuditLogService.entry(actorId, action, entityType, entityId, before, after);
  }

  static async listForEntity(entityType: string, entityId: string, limit = 50) {
    return db.query.auditLog.findMany({
      where: { entityType, entityId },
      with: { actor: { columns: { passwordHash: false } } },
      orderBy: { createdAt: "desc" },
      limit,
    });
  }
}
