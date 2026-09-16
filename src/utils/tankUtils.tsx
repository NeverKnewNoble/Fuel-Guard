import { CircleCheck, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";

import type { TankKind, TankLevel } from "@/types/tank";

/** Enough of a tank to draw its meter. */
type TankFill = { capacityL: number; currentL: number };

export function fillPercent(tank: TankFill) {
  if (tank.capacityL <= 0) return 0;
  return Math.min(100, Math.max(0, (tank.currentL / tank.capacityL) * 100));
}

export function levelOf(tank: TankFill): TankLevel {
  const pct = fillPercent(tank);
  if (pct < 20) return "critical";
  if (pct < 50) return "low";
  return "healthy";
}

/**
 * A meter, not a chart: the fill carries severity and the unfilled track is a
 * lighter step of the same ramp, so state reads across the whole bar.
 * Severity never rides on colour alone — each level ships an icon and a label.
 */
export const tankLevelStyles: Record<
  TankLevel,
  { label: string; icon: LucideIcon; fill: string; track: string; pill: string }
> = {
  healthy: {
    label: "Healthy",
    icon: CircleCheck,
    fill: "bg-emerald-600",
    track: "bg-emerald-100",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  low: {
    label: "Low",
    icon: TriangleAlert,
    fill: "bg-amber-500",
    track: "bg-amber-100",
    pill: "border-amber-200 bg-amber-50 text-amber-700",
  },
  critical: {
    label: "Critical",
    icon: ShieldAlert,
    fill: "bg-brand-600",
    track: "bg-brand-100",
    pill: "border-brand-200 bg-brand-50 text-brand-700",
  },
};

export const tankKindLabels: Record<TankKind, string> = {
  bulk: "Bulk tank",
  mobile_bowser: "Mobile bowser",
  day_tank: "Day tank",
};

/**
 * Colour for a reconciliation variance (measured − expected). A negative variance is
 * unexplained loss — the signal the whole system exists for. The service does the maths.
 */
export function varianceTone(varianceL: number) {
  if (varianceL <= -100) return "text-brand-700";
  if (varianceL < 0) return "text-amber-700";
  return "text-emerald-700";
}
