import { and, asc, desc, eq, gt, gte, isNotNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { fuelEntries, vDailyIssuance, vMonthlyEquipmentSummary } from "@/db/schema";
import type {
  ConsumptionComparison,
  DailyIssuancePoint,
  DailyIssuanceRange,
  DashboardKpis,
  DashboardOverview,
} from "@/types/dashboard";
import type { Actor } from "@/types/user";

import { EquipmentService } from "./equipmentService";
import { FuelEntryService } from "./fuelEntryService";
import { ReportingPeriodService } from "./reportingPeriodService";
import { SessionService } from "./sessionService";
import { TheftAlertService } from "./theftAlertService";
import { accraDay, inAccraMonth, monthStart, nextDay, round, shortDate } from "./utils";

const DAILY_ISSUANCE_DAYS = 11;
const DAY_MS = 24 * 60 * 60 * 1000;

export class DashboardService {
  /** `month` is 'YYYY-MM-01'; defaults to the current Accra month. */
  static async getKpis(month?: string): Promise<DashboardKpis> {
    const range = month ?? monthStart();
    const [[fuel], equipmentStats, alertCounts] = await Promise.all([
      db
        .select({
          litres: sql<number>`coalesce(sum(${fuelEntries.litres}), 0)`.mapWith(Number),
          cost: sql<number>`coalesce(sum(${fuelEntries.litres} * ${fuelEntries.unitCostGhs}), 0)`.mapWith(Number),
        })
        .from(fuelEntries)
        .where(inAccraMonth(fuelEntries.dispensedAt, range)),
      EquipmentService.getStats(),
      TheftAlertService.getCounts(),
    ]);

    const totalLitres = fuel?.litres ?? 0;
    const fuelCostGhs = round(fuel?.cost ?? 0);
    return {
      totalLitres,
      fuelCostGhs,
      avgCostPerLitre: totalLitres > 0 ? round(fuelCostGhs / totalLitres, 2) : 0,
      activeEquipment: equipmentStats.active,
      idleOrMaintenance: equipmentStats.idle + equipmentStats.maintenance,
      openAlerts: alertCounts.open,
      registeredUnits: equipmentStats.total,
    };
  }

  /** One point per Accra day in the range, with missing days filled as 0 so the line chart has no gaps. */
  static async getDailyIssuance(range: DailyIssuanceRange): Promise<DailyIssuancePoint[]> {
    const fromDay = accraDay(range.from);
    const toDay = accraDay(range.to);

    const rows = await db
      .select({
        day: vDailyIssuance.day,
        litres: sql<number>`coalesce(sum(${vDailyIssuance.litres}), 0)`.mapWith(Number),
      })
      .from(vDailyIssuance)
      .where(
        and(
          gte(vDailyIssuance.day, fromDay),
          lte(vDailyIssuance.day, toDay),
          range.siteId ? eq(vDailyIssuance.siteId, range.siteId) : undefined
        )
      )
      .groupBy(vDailyIssuance.day)
      .orderBy(asc(vDailyIssuance.day));

    const byDay = new Map(rows.map((r) => [r.day, r.litres]));
    const points: DailyIssuancePoint[] = [];
    for (let day = fromDay; day <= toDay; day = nextDay(day)) {
      // Noon UTC keeps the label on the same calendar day in any time zone.
      points.push({ date: shortDate(`${day}T12:00:00Z`), litres: byDay.get(day) ?? 0 });
    }
    return points;
  }

  /** Hour-metered units with fuel this period, worst variance first. */
  static async getConsumptionComparison(periodId: string, limit = 6): Promise<ConsumptionComparison[]> {
    const rows = await db
      .select({
        typeName: vMonthlyEquipmentSummary.typeName,
        code: vMonthlyEquipmentSummary.equipmentCode,
        actual: vMonthlyEquipmentSummary.avgLPerHr,
        standard: vMonthlyEquipmentSummary.lHrStandard,
      })
      .from(vMonthlyEquipmentSummary)
      .where(
        and(
          eq(vMonthlyEquipmentSummary.periodId, periodId),
          eq(vMonthlyEquipmentSummary.basis, "hours"),
          gt(vMonthlyEquipmentSummary.litres, "0"),
          isNotNull(vMonthlyEquipmentSummary.avgLPerHr),
          isNotNull(vMonthlyEquipmentSummary.lHrStandard)
        )
      )
      .orderBy(sql`${desc(vMonthlyEquipmentSummary.variancePct)} nulls last`)
      .limit(limit);

    return rows.map((r) => ({
      equipment: `${r.typeName} ${r.code}`,
      actual: Number(r.actual),
      standard: Number(r.standard),
    }));
  }

  /** Everything the Dashboard page needs, in one call. */
  static async getOverview(actor: Actor): Promise<DashboardOverview> {
    SessionService.assertAdmin(actor);
    const to = new Date();
    const from = new Date(to.getTime() - (DAILY_ISSUANCE_DAYS - 1) * DAY_MS);

    const [kpis, dailyIssuance, consumption, watchlist, recentEntries] = await Promise.all([
      DashboardService.getKpis(),
      DashboardService.getDailyIssuance({ from, to }),
      ReportingPeriodService.getCurrent().then((p) => DashboardService.getConsumptionComparison(p.id)),
      TheftAlertService.getWatchlist(),
      FuelEntryService.listRecent({ actor, limit: 6 }),
    ]);
    return { kpis, dailyIssuance, consumption, watchlist, recentEntries };
  }
}
