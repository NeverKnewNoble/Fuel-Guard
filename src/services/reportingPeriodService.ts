import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reportingPeriods, tankPeriodBalances, vTankReconciliation } from "@/db/schema";
import type { ReportingPeriod, ReportingPeriodListItem } from "@/types/period";
import type { Actor } from "@/types/user";
import { AUDIT_ACTIONS, AuditLogService } from "./auditLogService";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { SessionService } from "./sessionService";
import { type BatchWrites, formatMonth, monthStart, nextMonth, toNumber } from "./utils";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-01$/;

export class ReportingPeriodService {
  /** `month` is 'YYYY-MM-01'. */
  static async getOrCreate(month: string): Promise<ReportingPeriod> {
    if (!MONTH_PATTERN.test(month)) throw new ValidationError("A reporting period must start on the 1st of a month.", { month: "Pick a month" });

    await db.insert(reportingPeriods).values({ month }).onConflictDoNothing();
    const period = await findByMonth(month);
    return period!;
  }

  static async getCurrent(): Promise<ReportingPeriod> {
    return ReportingPeriodService.getOrCreate(monthStart());
  }

  static async getById(id: string): Promise<ReportingPeriod> {
    const period = await db.query.reportingPeriods.findFirst({ columns: { id: true, month: true, status: true }, where: { id } });
    if (!period) throw new NotFoundError("Reporting period");
    return period;
  }

  /** Newest first. Feeds the Monthly Summary month picker. */
  static async list(): Promise<ReportingPeriodListItem[]> {
    const rows = await db.query.reportingPeriods.findMany({
      with: { closer: { columns: { name: true } } },
      orderBy: { month: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      month: r.month,
      status: r.status,
      label: formatMonth(r.month),
      closedAt: r.closedAt,
      closedByName: r.closer?.name ?? null,
    }));
  }

  /** Blocks writes dated inside a closed month. A month with no period row yet is open. */
  static async assertOpen(at: Date): Promise<void> {
    const month = monthStart(at);
    const period = await findByMonth(month);
    if (period?.status === "closed") {
      throw new ValidationError(`${formatMonth(month)} is closed. Ask an administrator to reopen it.`);
    }
  }

  /**
   * Freezes each tank's closing dip as this month's closing balance and next month's opening balance.
   * Every tank needs a measured level first.
   */
  static async close(periodId: string, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const period = await ReportingPeriodService.getById(periodId);
    if (period.status !== "open") throw new ConflictError(`${formatMonth(period.month)} is already closed.`);

    const rows = await db
      .select()
      .from(vTankReconciliation)
      .where(eq(vTankReconciliation.periodId, periodId))
      .orderBy(asc(vTankReconciliation.tankCode));

    const missing = rows.filter((r) => r.measuredL === null);
    if (missing.length > 0) {
      throw new ValidationError(`Record a closing dip for: ${missing.map((r) => r.name).join(", ")}.`);
    }

    const next = await ReportingPeriodService.getOrCreate(nextMonth(period.month));

    const writes: BatchWrites = [
      db
        .update(reportingPeriods)
        .set({ status: "closed", closedBy: actor.id, closedAt: new Date() })
        .where(eq(reportingPeriods.id, periodId)),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.periodClose, "reporting_periods", periodId, { status: "open" }, {
        status: "closed",
        month: period.month,
        tanks: rows.map((r) => ({ tankCode: r.tankCode, measuredL: toNumber(r.measuredL), varianceL: toNumber(r.varianceL) })),
      }),
    ];

    for (const row of rows) {
      writes.push(
        // Keep an existing opening balance; only set the closing dip.
        db
          .insert(tankPeriodBalances)
          .values({ periodId, tankId: row.tankId, openingL: row.openingL, closingMeasuredL: row.measuredL })
          .onConflictDoUpdate({
            target: [tankPeriodBalances.periodId, tankPeriodBalances.tankId],
            set: { closingMeasuredL: row.measuredL },
          }),
        db
          .insert(tankPeriodBalances)
          .values({ periodId: next.id, tankId: row.tankId, openingL: row.measuredL! })
          .onConflictDoUpdate({
            target: [tankPeriodBalances.periodId, tankPeriodBalances.tankId],
            set: { openingL: row.measuredL! },
          })
      );
    }

    await db.batch(writes);
  }

  /** The next month's opening values stay until this month is closed again. */
  static async reopen(periodId: string, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const period = await ReportingPeriodService.getById(periodId);
    if (period.status !== "closed") throw new ConflictError(`${formatMonth(period.month)} is already open.`);

    const next = await findByMonth(nextMonth(period.month));
    if (next?.status === "closed") {
      throw new ConflictError(`${formatMonth(next.month)} is closed. Reopen it first.`);
    }

    await db.batch([
      db
        .update(reportingPeriods)
        .set({ status: "open", closedBy: null, closedAt: null })
        .where(eq(reportingPeriods.id, periodId)),
      db.update(tankPeriodBalances).set({ closingMeasuredL: null }).where(eq(tankPeriodBalances.periodId, periodId)),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.periodReopen, "reporting_periods", periodId, { status: "closed" }, {
        status: "open",
        month: period.month,
      }),
    ]);
  }
}

function findByMonth(month: string) {
  return db.query.reportingPeriods.findFirst({ columns: { id: true, month: true, status: true }, where: { month } });
}
