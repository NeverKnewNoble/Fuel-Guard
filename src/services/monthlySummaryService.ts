import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { sites, vMonthlyEquipmentSummary } from "@/db/schema";
import type { MonthlyEquipmentRow, MonthlyReport, MonthlySummaryFilters, MonthlyTotals, VarianceStatus } from "@/types/monthly";
import { toNumber } from "./utils";

const CSV_HEADERS = ["Equipment", "Type", "Site", "Qty (L)", "Km", "Hours", "Consumption avg", "Standard", "Variance %", "Cost (GHS)", "Status"];

/**
 * Monthly Summary page. `toCsv` has no permission check of its own: serve it from a Route Handler that calls
 * `SessionService.requireAdmin()` first (`src/app/portal/(admin)/monthly_summary/export/route.ts`).
 */
export class MonthlySummaryService {
  static async getRows(periodId: string, filters: MonthlySummaryFilters = {}): Promise<MonthlyEquipmentRow[]> {
    if (filters.equipmentIds && filters.equipmentIds.length === 0) return [];

    const rows = await db
      .select({
        equipmentId: vMonthlyEquipmentSummary.equipmentId,
        equipmentCode: vMonthlyEquipmentSummary.equipmentCode,
        typeName: vMonthlyEquipmentSummary.typeName,
        basis: vMonthlyEquipmentSummary.basis,
        siteId: vMonthlyEquipmentSummary.siteId,
        siteName: sites.name,
        litres: vMonthlyEquipmentSummary.litres,
        totalKm: vMonthlyEquipmentSummary.totalKm,
        totalHours: vMonthlyEquipmentSummary.totalHours,
        avgLPerKm: vMonthlyEquipmentSummary.avgLPerKm,
        avgLPerHr: vMonthlyEquipmentSummary.avgLPerHr,
        lKmStandard: vMonthlyEquipmentSummary.lKmStandard,
        lHrStandard: vMonthlyEquipmentSummary.lHrStandard,
        variancePct: vMonthlyEquipmentSummary.variancePct,
        costGhs: vMonthlyEquipmentSummary.costGhs,
        status: vMonthlyEquipmentSummary.status,
      })
      .from(vMonthlyEquipmentSummary)
      .innerJoin(sites, eq(sites.id, vMonthlyEquipmentSummary.siteId))
      .where(
        and(
          eq(vMonthlyEquipmentSummary.periodId, periodId),
          filters.siteId ? eq(vMonthlyEquipmentSummary.siteId, filters.siteId) : undefined,
          filters.equipmentIds ? inArray(vMonthlyEquipmentSummary.equipmentId, filters.equipmentIds) : undefined
        )
      )
      .orderBy(asc(vMonthlyEquipmentSummary.equipmentCode));

    return rows.map((r) => {
      const variancePct = toNumber(r.variancePct);
      return {
        equipmentId: r.equipmentId,
        equipmentCode: r.equipmentCode,
        basis: r.basis,
        siteId: r.siteId,
        type: r.typeName,
        site: r.siteName,
        qtyL: Number(r.litres),
        km: toNumber(r.totalKm),
        hours: toNumber(r.totalHours),
        lKmAvg: toNumber(r.avgLPerKm),
        lHrAvg: toNumber(r.avgLPerHr),
        lKmStd: toNumber(r.lKmStandard),
        lHrStd: toNumber(r.lHrStandard),
        // Split the one variance column by basis.
        varLKm: r.basis === "km" ? variancePct : null,
        varLHr: r.basis === "hours" ? variancePct : null,
        costGhs: Number(r.costGhs),
        status: r.status as VarianceStatus,
      };
    });
  }

  static async getTotals(periodId: string): Promise<MonthlyTotals> {
    const [row] = await db
      .select({
        totalLitres: sql<number>`coalesce(sum(${vMonthlyEquipmentSummary.litres}), 0)`.mapWith(Number),
        totalCostGhs: sql<number>`coalesce(sum(${vMonthlyEquipmentSummary.costGhs}), 0)`.mapWith(Number),
        flaggedUnits: sql<number>`count(*) filter (where ${vMonthlyEquipmentSummary.status} <> 'normal')`.mapWith(Number),
      })
      .from(vMonthlyEquipmentSummary)
      .where(eq(vMonthlyEquipmentSummary.periodId, periodId));
    return row ?? { totalLitres: 0, totalCostGhs: 0, flaggedUnits: 0 };
  }

  /** The rows and their totals together, for the page's one request. */
  static async getReport(periodId: string, filters: MonthlySummaryFilters = {}): Promise<MonthlyReport> {
    const [rows, totals] = await Promise.all([
      MonthlySummaryService.getRows(periodId, filters),
      MonthlySummaryService.getTotals(periodId),
    ]);
    return { periodId, rows, totals };
  }

  /** Same columns as the table. Every value is quoted, with any `"` doubled. */
  static async toCsv(periodId: string, equipmentIds?: string[]): Promise<string> {
    const rows = await MonthlySummaryService.getRows(periodId, { equipmentIds });
    const lines = rows.map((r) => {
      const km = r.basis === "km";
      return [
        r.equipmentCode,
        r.type,
        r.site,
        r.qtyL,
        r.km,
        r.hours,
        km ? r.lKmAvg : r.lHrAvg,
        km ? r.lKmStd : r.lHrStd,
        km ? r.varLKm : r.varLHr,
        r.costGhs,
        r.status,
      ];
    });
    return [CSV_HEADERS, ...lines].map((line) => line.map(csvCell).join(",")).join("\r\n");
  }
}

const csvCell = (value: string | number | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;
