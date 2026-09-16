export type MeasurementBasis = "Hour meter (hrs)" | "Odometer (km)";

/** How an equipment type's usage is measured (the `measurement_basis` enum). */
export type Basis = "hours" | "km";

export type ThresholdLevel = "watch" | "high" | "critical";

export type AlertThreshold = {
  level: ThresholdLevel;
  label: string;
  /** % variance above standard that triggers this severity. */
  percent: number;
};

/** `{ watch: 5, high: 15, critical: 25 }` */
export type ThresholdMap = Record<ThresholdLevel, number>;

export type EquipmentTypeRow = {
  id: string;
  name: string;
  basis: Basis;
  measurementLabel: MeasurementBasis;
  lKmStandard: number | null;
  lHrStandard: number | null;
  unitCount: number;
};

export type EquipmentTypeDetail = Omit<EquipmentTypeRow, "measurementLabel" | "unitCount">;

export type CreateEquipmentTypeInput = { name: string; basis: Basis; lKmStandard?: number | null; lHrStandard?: number | null };

export type UpdateStandardInput = { basis: Basis; lKmStandard?: number | null; lHrStandard?: number | null };
