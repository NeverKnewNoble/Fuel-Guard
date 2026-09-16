import type { Basis } from "@/types/standards";

export type EquipmentStatus = "active" | "maintenance" | "idle";

/** Every `equipment_status` value, including `retired`, which the UI's status pills don't show. */
export type EquipmentRecordStatus = EquipmentStatus | "retired";

export type Equipment = {
  id: string;
  type: string;
  makeModel: string;
  site: string;
  status: EquipmentStatus;
  /** Litres per km — set for road vehicles, null for hour-metered plant. */
  lKmStd: number | null;
  /** Litres per hour — set for hour-metered plant, null for road vehicles. */
  lHrStd: number | null;
};

/** One row of the Equipment & Vehicles → Registry table. Standards are the effective ones (override ?? type default). */
export type EquipmentRow = {
  id: string;
  code: string;
  typeName: string;
  basis: Basis;
  makeModel: string;
  siteId: string;
  siteName: string;
  status: EquipmentRecordStatus;
  lKmStd: number | null;
  lHrStd: number | null;
};

export type EquipmentFilters = { siteId?: string; status?: EquipmentRecordStatus; typeId?: string; search?: string };

export type EquipmentStats = { active: number; maintenance: number; idle: number; retired: number; total: number };

export type EquipmentDetail = {
  id: string;
  code: string;
  makeModel: string;
  registrationNo: string | null;
  status: EquipmentRecordStatus;
  siteId: string;
  equipmentTypeId: string;
  fuelTankCapacityL: number | null;
  lKmStandardOverride: number | null;
  lHrStandardOverride: number | null;
  type: { id: string; name: string; basis: Basis; lKmStandard: number | null; lHrStandard: number | null };
  site: { id: string; code: string; name: string };
};

export type EffectiveStandard = { basis: Basis; lKmStandard: number | null; lHrStandard: number | null };

/** New Fuel Entry → Equipment select. */
export type EquipmentFormOption = {
  id: string;
  code: string;
  typeName: string;
  basis: Basis;
  siteId: string;
  /** "EQ-001 — Excavator" */
  label: string;
};

export type CreateEquipmentInput = {
  /** Leave empty to let the sequence generate `EQ-###`. */
  code?: string;
  equipmentTypeId: string;
  makeModel: string;
  registrationNo?: string | null;
  siteId: string;
  fuelTankCapacityL?: number | null;
  lKmStandardOverride?: number | null;
  lHrStandardOverride?: number | null;
};
