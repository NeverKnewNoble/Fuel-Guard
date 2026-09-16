import type { AlertRule, AlertSeverity, AlertState, Finding } from "@/types/alerts";
import type { Basis } from "@/types/standards";
import type { Actor } from "@/types/user";

export type EntryStatus = "locked" | "flagged" | "watch";

/**
 * One line of the daily fuel log: the register the client's sheet describes, with the meter readings
 * and the consumption worked out from them. Used by Fuel Entry and the Dashboard's recent entries.
 */
export type LogEntryRow = {
  id: string;
  code: string;
  equipmentCode: string;
  equipmentType: string;
  basis: Basis;
  /** Who was driving or operating — not who typed the entry in. */
  operatorName: string;
  status: EntryStatus;
  recordedBy: string;
  litres: number;
  odometerStart: number | null;
  odometerEnd: number | null;
  totalKm: number | null;
  lPerKm: number | null;
  hourMeterStart: number | null;
  hourMeterEnd: number | null;
  totalHours: number | null;
  lPerHr: number | null;
  locationActivity: string;
  siteName: string;
  dispensedAt: Date;
  /** Set when the entry was recorded in error: shown as void, ignored by every total. */
  voidedAt: Date | null;
};

export type FuelEntryListOptions = { actor: Actor; status?: EntryStatus; limit?: number; before?: Date };

export type FuelEntrySummary = { total: number; litres: number; flagged: number; watch: number; locked: number };

export type CreateFuelEntryInput = {
  dispensedAt: Date;
  equipmentId: string;
  tankId: string;
  operatorId: string;
  litres: number;
  odometerStart: number | null;
  odometerEnd: number | null;
  hourMeterStart: number | null;
  hourMeterEnd: number | null;
  locationActivity: string;
};

export type CreateFuelEntryResult = {
  entry: { id: string; code: string; status: EntryStatus };
  alerts: Finding[];
  /** Non-blocking notes for the form, e.g. more litres drawn than the tanker's last dip showed. */
  warnings: string[];
};

export type CorrectableField =
  | "dispensedAt"
  | "operatorId"
  | "litres"
  | "odometerStart"
  | "odometerEnd"
  | "hourMeterStart"
  | "hourMeterEnd"
  | "locationActivity";

/** Stored in `fuel_entry_corrections.changes`. Dates are ISO strings. */
export type CorrectionChanges = Partial<Record<CorrectableField, { from: unknown; to: unknown }>>;

export type CorrectionRequestInput = {
  fuelEntryId: string;
  changes: Partial<Record<CorrectableField, unknown>>;
  reason: string;
};

/** One change, ready to show as "Litres: 210 → 201". */
export type CorrectionChangeLine = { field: CorrectableField; label: string; from: string; to: string; text: string };

export type CorrectionRow = {
  id: string;
  fuelEntryId: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  changes: CorrectionChangeLine[];
  requestedBy: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: Date | null;
  createdAt: Date;
};

export type PendingCorrectionRow = CorrectionRow & { entryCode: string; equipmentCode: string };

export type FuelEntryDetail = {
  id: string;
  code: string;
  dispensedAt: Date;
  status: EntryStatus;
  locationActivity: string;
  litres: number;
  odometerStart: number | null;
  odometerEnd: number | null;
  hourMeterStart: number | null;
  hourMeterEnd: number | null;
  totalKm: number | null;
  totalHours: number | null;
  lPerKm: number | null;
  lPerHr: number | null;
  unitCostGhs: number;
  costGhs: number;
  createdAt: Date;
  equipment: { id: string; code: string; makeModel: string; typeName: string; basis: Basis };
  tank: { id: string; code: string; name: string };
  operator: { id: string; name: string };
  site: { id: string; name: string };
  recorder: { id: string; name: string };
  alerts: { id: string; code: string; rule: AlertRule; severity: AlertSeverity; state: AlertState; summary: string; detectedAt: Date }[];
  corrections: CorrectionRow[];
};
