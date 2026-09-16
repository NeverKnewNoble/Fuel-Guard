import type { Basis } from "@/types/standards";

export type VarianceStatus = "normal" | "watch" | "high" | "critical";

export type MonthlySummaryRow = {
  equipmentId: string;
  type: string;
  site: string;
  qtyL: number;
  km: number | null;
  hours: number | null;
  lKmAvg: number | null;
  lHrAvg: number | null;
  lKmStd: number | null;
  lHrStd: number | null;
  /** Percentage variance against standard; null when the basis doesn't apply. */
  varLKm: number | null;
  varLHr: number | null;
  costGhs: number;
  status: VarianceStatus;
};

/** What `MonthlySummaryService.getRows` returns: `equipmentId` is the real id, so show `equipmentCode` in the table. */
export type MonthlyEquipmentRow = MonthlySummaryRow & { equipmentCode: string; basis: Basis; siteId: string };

export type MonthlySummaryFilters = { siteId?: string; equipmentIds?: string[] };

export type MonthlyTotals = { totalLitres: number; totalCostGhs: number; flaggedUnits: number };

export type MonthlyReport = { periodId: string; rows: MonthlyEquipmentRow[]; totals: MonthlyTotals };
