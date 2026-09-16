import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { vTankReconciliation } from "@/db/schema";
import type { ReconciliationReport, ReconciliationRow } from "@/types/tank";
import { ReportingPeriodService } from "./reportingPeriodService";
import { formatMonth, round, toNumber } from "./utils";

/** Tankers → Stock reconciliation: opening + intake − issued = expected, compared with the measured dip. */
export class ReconciliationService {
  static async getForPeriod(periodId: string): Promise<ReconciliationRow[]> {
    const rows = await db
      .select()
      .from(vTankReconciliation)
      .where(eq(vTankReconciliation.periodId, periodId))
      .orderBy(asc(vTankReconciliation.tankCode));

    return rows.map((r) => {
      const varianceL = toNumber(r.varianceL);
      return {
        tankId: r.tankId,
        tankCode: r.tankCode,
        name: r.name,
        openingL: Number(r.openingL),
        intakeL: Number(r.intakeL),
        issuedL: Number(r.issuedL),
        expectedL: Number(r.expectedL),
        measuredL: toNumber(r.measuredL),
        varianceL,
        hasLoss: varianceL !== null && varianceL < 0,
      };
    });
  }

  static async getCurrent(): Promise<ReconciliationRow[]> {
    const period = await ReportingPeriodService.getCurrent();
    return ReconciliationService.getForPeriod(period.id);
  }

  /** The current month's rows, plus the month itself and the total unexplained loss, for the Tankers card. */
  static async getCurrentReport(): Promise<ReconciliationReport> {
    const period = await ReportingPeriodService.getCurrent();
    const rows = await ReconciliationService.getForPeriod(period.id);
    const lossL = rows.reduce((sum, r) => sum + (r.varianceL !== null && r.varianceL < 0 ? -r.varianceL : 0), 0);
    return { period: { ...period, label: formatMonth(period.month) }, rows, lossL: round(lossL) };
  }

  /** Sum of the negative variances, as a positive number ("Unexplained loss this month"). */
  static async getLossTotal(periodId: string): Promise<number> {
    const [row] = await db
      .select({
        loss: sql<number>`coalesce(sum(case when ${vTankReconciliation.varianceL} < 0 then -${vTankReconciliation.varianceL} else 0 end), 0)`.mapWith(Number),
      })
      .from(vTankReconciliation)
      .where(eq(vTankReconciliation.periodId, periodId));
    return row?.loss ?? 0;
  }
}
