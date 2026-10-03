import type { ReportingPeriod } from "@/types/period";

export type TankLevel = "healthy" | "low" | "critical";

export type TankKind = "bulk" | "mobile_bowser" | "day_tank";

/** Tanks → tank cards. */
export type TankCardData = {
  id: string;
  code: string;
  name: string;
  siteId: string;
  siteName: string;
  capacityL: number;
  /** Running level: the last dip, plus deliveries and transfers in, minus fuel issued and transferred out since it. */
  currentL: number;
  fillPct: number;
  /** The last dip itself, `null` when the tank has never been dipped. */
  measuredL: number | null;
  measuredAt: Date | null;
  /** Net litres in (+) or out (−) since that dip. `0` means the level is as measured. */
  sinceDipL: number;
  lastRefillAt: Date | null;
  level: TankLevel;
};

export type TankTotals = { totalAvailableL: number; tankCount: number };

/** Fuel entry & intake tank selects. */
export type TankOption = {
  id: string;
  code: string;
  name: string;
  capacityL: number;
  /** Running level, as on the tank cards. */
  currentL: number;
  siteId: string;
  siteName: string;
};

export type TankDetail = {
  id: string;
  code: string;
  name: string;
  kind: TankKind;
  siteId: string;
  capacityL: number;
  archivedAt: Date | null;
  site: { id: string; code: string; name: string };
};

export type CreateTankInput = { code?: string; name: string; kind: TankKind; siteId: string; capacityL: number; openingL?: number | null };

export type UpdateTankInput = Partial<Omit<CreateTankInput, "openingL">>;

export type IntakeRow = {
  id: string;
  code: string;
  tankId: string;
  tankName: string;
  supplierId: string;
  supplier: string;
  deliveryNote: string;
  litres: number;
  costPerLitre: number;
  totalCost: number;
  receivedById: string;
  receivedBy: string;
  receivedAt: Date;
  /** Set when the delivery was recorded in error: kept in the log, ignored by stock and costs. */
  voidedAt: Date | null;
  voidedBy: string | null;
  voidReason: string | null;
};

export type IntakeFilters = { tankId?: string; from?: Date; to?: Date; limit?: number };

export type CreateIntakeInput = {
  tankId: string;
  supplierName: string;
  deliveryNote: string;
  litres: number;
  costPerLitre: number;
  receivedAt: Date;
  receivedById: string;
};

/** Everything about a delivery that can be corrected. The tank it went into can't change — void it and record another. */
export type UpdateIntakeInput = Omit<CreateIntakeInput, "tankId">;

export type TransferRow = {
  id: string;
  code: string;
  fromTankId: string;
  fromTankName: string;
  toTankId: string;
  toTankName: string;
  litres: number;
  note: string | null;
  transferredBy: string;
  transferredAt: Date;
  /** Set when the transfer was recorded in error: kept in the log, ignored by stock. */
  voidedAt: Date | null;
  voidedBy: string | null;
  voidReason: string | null;
};

export type CreateTransferInput = { fromTankId: string; toTankId: string; litres: number; transferredAt: Date; note?: string };

export type RecordDipInput = { tankId: string; measuredL: number; measuredAt: Date; note?: string };

export type TankDipRow = { id: string; measuredL: number; measuredAt: Date; note: string | null; recordedBy: { id: string; name: string } };

export type ReconciliationRow = {
  tankId: string;
  tankCode: string;
  name: string;
  openingL: number;
  intakeL: number;
  issuedL: number;
  transferInL: number;
  transferOutL: number;
  expectedL: number;
  measuredL: number | null;
  /** measured − expected; negative = unexplained loss. */
  varianceL: number | null;
  hasLoss: boolean;
};

export type ReconciliationReport = {
  period: ReportingPeriod & { label: string };
  rows: ReconciliationRow[];
  /** Sum of the negative variances, as a positive number of litres. */
  lossL: number;
};
