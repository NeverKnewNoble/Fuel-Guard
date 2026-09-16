import type { AlertSeverity, DetectionContext, Finding } from "@/types/alerts";
import type { EntryStatus } from "@/types/fuelLog";

import { AlertThresholdService } from "./alertThresholdService";
import { formatLitres, round } from "./utils";

const COUNT_WORDS = ["", "One", "Two", "Three", "Four", "Five"];

/**
 * Pure functions: everything they need is passed in, so they can be unit tested without a database.
 * Used by `FuelEntryService.create` and `FuelEntryCorrectionService.approve`.
 */
export class AlertDetectionService {
  static readonly REPEAT_TOP_UP_WINDOW_MINUTES = 60;

  static evaluate(ctx: DetectionContext): Finding[] {
    return [
      AlertDetectionService.checkOverStandard(ctx),
      AlertDetectionService.checkExceedsTankCapacity(ctx),
      AlertDetectionService.checkRepeatTopUp(ctx),
      AlertDetectionService.checkNoMeterMovement(ctx),
    ].filter((f): f is Finding => f !== null);
  }

  static checkOverStandard(ctx: DetectionContext): Finding | null {
    const { entry, equipment, thresholds } = ctx;
    const hours = equipment.basis === "hours";
    const usage = hours ? entry.totalHours : entry.totalKm;
    const standard = hours ? equipment.lHrStandard : equipment.lKmStandard;
    // Zero usage is checkNoMeterMovement's job; no standard means nothing to compare against.
    if (usage === null || usage <= 0 || standard === null || standard <= 0) return null;

    const rate = entry.litres / usage;
    const variancePct = round(((rate - standard) / standard) * 100);
    const severity = AlertThresholdService.severityFor(variancePct, thresholds);
    if (!severity) return null;

    const unit = hours ? "L/hr" : "L/km";
    const dp = hours ? 1 : 3;
    return {
      rule: "over_standard",
      severity,
      variancePct,
      summary: `Consumption ${variancePct}% above standard (${trim(rate, dp)} vs ${trim(standard, dp)} ${unit}).`,
      relatedEntryIds: [],
    };
  }

  static checkExceedsTankCapacity(ctx: DetectionContext): Finding | null {
    const { entry, equipment } = ctx;
    const capacity = equipment.fuelTankCapacityL;
    if (capacity === null || capacity <= 0 || entry.litres <= capacity) return null;

    return {
      rule: "exceeds_tank_capacity",
      severity: "critical",
      variancePct: round(((entry.litres - capacity) / capacity) * 100),
      summary: `Refill of ${formatLitres(entry.litres)} L exceeds the unit's ${formatLitres(capacity)} L tank capacity.`,
      relatedEntryIds: [],
    };
  }

  static checkRepeatTopUp(ctx: DetectionContext): Finding | null {
    const { entry } = ctx;
    const windowMs = AlertDetectionService.REPEAT_TOP_UP_WINDOW_MINUTES * 60 * 1000;
    const at = entry.dispensedAt.getTime();

    const matches = previousOf(ctx).filter((p) => {
      const gap = at - p.dispensedAt.getTime();
      return gap >= 0 && gap <= windowMs;
    });
    if (matches.length === 0) return null;

    const earliest = Math.min(...matches.map((p) => p.dispensedAt.getTime()));
    const minutes = Math.max(1, Math.round((at - earliest) / 60000));
    const topUps = matches.length + 1;
    const countText = COUNT_WORDS[topUps] ?? String(topUps);

    return {
      rule: "repeat_top_up",
      severity: matches.length >= 2 ? "high" : "watch",
      variancePct: null,
      summary: `${countText} top-ups logged within ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      relatedEntryIds: matches.map((p) => p.id),
    };
  }

  static checkNoMeterMovement(ctx: DetectionContext): Finding | null {
    const { entry, equipment } = ctx;
    const hours = equipment.basis === "hours";
    const meter = hours ? "hour meter" : "odometer";
    const total = hours ? entry.totalHours : entry.totalKm;

    if (entry.litres > 0 && total === 0) {
      return {
        rule: "no_meter_movement",
        severity: "high",
        variancePct: null,
        summary: `Fuel drawn without a matching ${meter} movement.`,
        relatedEntryIds: [],
      };
    }

    // The meter went backwards since the previous fill.
    const start = hours ? entry.hourMeterStart : entry.odometerStart;
    const previous = previousOf(ctx).find((p) => (hours ? p.hourMeterEnd : p.odometerEnd) !== null);
    const previousEnd = previous ? (hours ? previous.hourMeterEnd : previous.odometerEnd) : null;
    if (start !== null && previous && previousEnd !== null && start < previousEnd) {
      return {
        rule: "no_meter_movement",
        severity: "watch",
        variancePct: null,
        summary: `The ${meter} start reading (${trim(start, 1)}) is below the previous entry's end reading (${trim(previousEnd, 1)}).`,
        relatedEntryIds: [previous.id],
      };
    }

    return null;
  }

  /** The Fuel Entry page's status pills. */
  static entryStatusFor(findings: Finding[]): EntryStatus {
    if (findings.length === 0) return "locked";
    const serious: AlertSeverity[] = ["high", "critical"];
    return findings.some((f) => serious.includes(f.severity)) ? "flagged" : "watch";
  }
}

/** Earlier entries for the same unit, newest first, never including the entry being checked. */
function previousOf(ctx: DetectionContext) {
  return ctx.previousEntries
    .filter((p) => p.id !== ctx.entry.id)
    .sort((a, b) => b.dispensedAt.getTime() - a.dispensedAt.getTime());
}

const trim = (n: number, dp: number) => String(round(n, dp));
