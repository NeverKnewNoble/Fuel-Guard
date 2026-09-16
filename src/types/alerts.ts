import type { EntryStatus } from "@/types/fuelLog";
import type { Basis, ThresholdMap } from "@/types/standards";

export type AlertSeverity = "critical" | "high" | "watch";

export type AlertState = "open" | "reviewing" | "resolved";

export type AlertRule = "over_standard" | "exceeds_tank_capacity" | "repeat_top_up" | "no_meter_movement";

/** Everything `AlertDetectionService` needs — passed in, so detection needs no database. */
export type DetectionContext = {
  entry: {
    id: string;
    dispensedAt: Date;
    litres: number;
    totalKm: number | null;
    totalHours: number | null;
    odometerStart: number | null;
    hourMeterStart: number | null;
  };
  equipment: {
    id: string;
    code: string;
    typeName: string;
    siteId: string;
    basis: Basis;
    lKmStandard: number | null;
    lHrStandard: number | null;
    fuelTankCapacityL: number | null;
  };
  thresholds: ThresholdMap;
  /** Same equipment's entries before this one, newest first (last 24 h is enough). */
  previousEntries: { id: string; dispensedAt: Date; litres: number; odometerEnd: number | null; hourMeterEnd: number | null }[];
};

export type Finding = {
  rule: AlertRule;
  severity: AlertSeverity;
  variancePct: number | null;
  summary: string;
  /** Other fuel entries that are evidence, besides the new one. */
  relatedEntryIds: string[];
};

/** Theft Alerts → Alert queue. */
export type AlertRow = {
  id: string;
  code: string;
  equipmentId: string;
  equipmentCode: string;
  /** The equipment type name. */
  equipmentName: string;
  siteName: string;
  rule: AlertRule;
  severity: AlertSeverity;
  state: AlertState;
  variancePct: number | null;
  summary: string;
  detectedAt: Date;
  /** Resolved alerts always count as read. */
  isRead: boolean;
};

export type AlertListOptions = {
  userId: string;
  state?: AlertState;
  severity?: AlertSeverity;
  siteId?: string;
  limit?: number;
  /** Cursor paging: only alerts detected before this. */
  before?: Date;
};

/** Open counts exclude resolved alerts. */
export type AlertCounts = { critical: number; high: number; watch: number; resolvedThisMonth: number; open: number };

export type AlertDetail = {
  id: string;
  code: string;
  rule: AlertRule;
  severity: AlertSeverity;
  state: AlertState;
  variancePct: number | null;
  summary: string;
  detectedAt: Date;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  resolvedBy: { id: string; name: string } | null;
  equipment: { id: string; code: string; makeModel: string; typeName: string };
  site: { id: string; name: string };
  fuelEntries: { id: string; code: string; dispensedAt: Date; litres: number; status: EntryStatus; recordedBy: string }[];
};

/** Dashboard → Anomaly watchlist. One row per equipment. */
export type WatchlistItem = { id: string; equipmentId: string; equipmentCode: string; equipmentName: string; severity: AlertSeverity };
