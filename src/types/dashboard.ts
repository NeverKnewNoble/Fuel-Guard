import type { WatchlistItem } from "@/types/alerts";
import type { LogEntryRow } from "@/types/fuelLog";

export type DailyIssuancePoint = {
  /** Short axis label, e.g. "Sep 1". */
  date: string;
  litres: number;
};

export type ConsumptionComparison = {
  equipment: string;
  /** Measured litres per hour. */
  actual: number;
  /** Standard litres per hour for that equipment. */
  standard: number;
};

export type DashboardKpis = {
  totalLitres: number;
  fuelCostGhs: number;
  avgCostPerLitre: number;
  activeEquipment: number;
  idleOrMaintenance: number;
  openAlerts: number;
  registeredUnits: number;
};

export type DailyIssuanceRange = { from: Date; to: Date; siteId?: string };

export type DashboardOverview = {
  kpis: DashboardKpis;
  dailyIssuance: DailyIssuancePoint[];
  consumption: ConsumptionComparison[];
  watchlist: WatchlistItem[];
  recentEntries: LogEntryRow[];
};
