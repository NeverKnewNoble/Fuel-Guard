import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { alertFuelEntries, fuelEntries, theftAlerts, vTankLevels } from "@/db/schema";
import type { DetectionContext, Finding } from "@/types/alerts";
import type { EquipmentDetail } from "@/types/equipment";
import type {
  CreateFuelEntryInput,
  CreateFuelEntryResult,
  EntryStatus,
  FuelEntryDetail,
  FuelEntryListOptions,
  FuelEntrySummary,
  LogEntryRow,
} from "@/types/fuelLog";
import type { Basis } from "@/types/standards";
import type { Actor } from "@/types/user";
import { formatDateTime } from "@/utils/formatDate";

import { AlertDetectionService } from "./alertDetectionService";
import { AlertThresholdService } from "./alertThresholdService";
import { EquipmentService } from "./equipmentService";
import { AUDIT_ACTIONS, AuditLogService } from "./auditLogService";
import { ConflictError, ForbiddenError, NotFoundError, nullIfNotFound, throwIfInvalid } from "./errors";
import { FuelEntryCorrectionService } from "./fuelEntryCorrectionService";
import { ReportingPeriodService } from "./reportingPeriodService";
import { SessionService } from "./sessionService";
import { TankService } from "./tankService";
import { type BatchWrites, formatLitres, isInFuture, isValidDate, round, toNumber, toNumeric, toNumericOrNull } from "./utils";

const DAY_MS = 24 * 60 * 60 * 1000;

const CSV_HEADERS = [
  "Date",
  "Entry",
  "Equipment no/ID",
  "Equipment type",
  "Driver / operator",
  "Qty of fuel issued (L)",
  "ODM reading start",
  "ODM reading end",
  "Total km done",
  "L/km consumption",
  "HM reading start",
  "HM reading end",
  "Total hours done",
  "L/hr consumption",
  "Location & activity",
  "Site",
  "Recorded by",
  "Status",
];

/** Every value quoted, with any `"` doubled. */
const csvCell = (value: string | number | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;

/**
 * Records takers never edit a submitted entry: they request a correction (`FuelEntryCorrectionService`).
 * An administrator can edit one directly with `update`, or void one recorded in error with `setVoided`.
 */
export class FuelEntryService {
  /** Records takers see the entries they recorded ("My Recent Entries"); admins see all. */
  static async listRecent(options: FuelEntryListOptions): Promise<LogEntryRow[]> {
    const { actor } = options;
    const rows = await db.query.fuelEntries.findMany({
      columns: {
        id: true,
        code: true,
        status: true,
        litres: true,
        dispensedAt: true,
        voidedAt: true,
        odometerStart: true,
        odometerEnd: true,
        totalKm: true,
        lPerKm: true,
        hourMeterStart: true,
        hourMeterEnd: true,
        totalHours: true,
        lPerHr: true,
        locationActivity: true,
      },
      where: {
        recordedBy: SessionService.isAdmin(actor) ? undefined : actor.id,
        status: options.status,
        dispensedAt: options.before ? { lt: options.before } : undefined,
      },
      with: {
        equipment: { columns: { code: true }, with: { type: { columns: { name: true, basis: true } } } },
        operator: { columns: { name: true } },
        recorder: { columns: { name: true } },
        site: { columns: { name: true } },
      },
      orderBy: { dispensedAt: "desc" },
      limit: options.limit ?? 50,
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      equipmentCode: r.equipment.code,
      equipmentType: r.equipment.type.name,
      basis: r.equipment.type.basis,
      operatorName: r.operator.name,
      status: r.status,
      recordedBy: r.recorder.name,
      litres: Number(r.litres),
      odometerStart: toNumber(r.odometerStart),
      odometerEnd: toNumber(r.odometerEnd),
      totalKm: toNumber(r.totalKm),
      lPerKm: toNumber(r.lPerKm),
      hourMeterStart: toNumber(r.hourMeterStart),
      hourMeterEnd: toNumber(r.hourMeterEnd),
      totalHours: toNumber(r.totalHours),
      lPerHr: toNumber(r.lPerHr),
      locationActivity: r.locationActivity,
      siteName: r.site.name,
      dispensedAt: r.dispensedAt,
      voidedAt: r.voidedAt,
    }));
  }

  /** KPI tiles and tab counts. "Needs review" = `flagged + watch`. */
  static async getSummary(options: { actor: Actor; since?: Date }): Promise<FuelEntrySummary> {
    const { actor, since } = options;
    const countWhere = (status: EntryStatus) => sql<number>`count(*) filter (where ${fuelEntries.status} = ${status})`.mapWith(Number);
    const [row] = await db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        litres: sql<number>`coalesce(sum(${fuelEntries.litres}), 0)`.mapWith(Number),
        flagged: countWhere("flagged"),
        watch: countWhere("watch"),
        locked: countWhere("locked"),
      })
      .from(fuelEntries)
      .where(
        and(
          SessionService.isAdmin(actor) ? undefined : eq(fuelEntries.recordedBy, actor.id),
          since ? gte(fuelEntries.dispensedAt, since) : undefined,
          // A void entry never happened, so it can't count towards the tiles or the tab counts.
          sql`${fuelEntries.voidedAt} is null`
        )
      );
    return row ?? { total: 0, litres: 0, flagged: 0, watch: 0, locked: 0 };
  }

  static async getById(id: string, actor: Actor): Promise<FuelEntryDetail> {
    const row = await db.query.fuelEntries.findFirst({
      where: { id },
      with: {
        equipment: { with: { type: true } },
        tank: { columns: { id: true, code: true, name: true } },
        operator: { columns: { id: true, name: true } },
        recorder: { columns: { id: true, name: true } },
        site: { columns: { id: true, name: true } },
        alerts: true,
        corrections: {
          with: { requester: { columns: { id: true, name: true } }, reviewer: { columns: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!row) throw new NotFoundError("Fuel entry");
    FuelEntryService.assertCanOpen(actor, row.recordedBy);

    const litres = Number(row.litres);
    const unitCostGhs = Number(row.unitCostGhs);
    return {
      id: row.id,
      code: row.code,
      dispensedAt: row.dispensedAt,
      status: row.status,
      locationActivity: row.locationActivity,
      litres,
      odometerStart: toNumber(row.odometerStart),
      odometerEnd: toNumber(row.odometerEnd),
      hourMeterStart: toNumber(row.hourMeterStart),
      hourMeterEnd: toNumber(row.hourMeterEnd),
      totalKm: toNumber(row.totalKm),
      totalHours: toNumber(row.totalHours),
      lPerKm: toNumber(row.lPerKm),
      lPerHr: toNumber(row.lPerHr),
      unitCostGhs,
      costGhs: round(litres * unitCostGhs),
      createdAt: row.createdAt,
      equipment: {
        id: row.equipment.id,
        code: row.equipment.code,
        makeModel: row.equipment.makeModel,
        typeName: row.equipment.type.name,
        basis: row.equipment.type.basis,
      },
      tank: row.tank,
      operator: row.operator,
      site: row.site,
      recorder: row.recorder,
      alerts: row.alerts.map((a) => ({
        id: a.id,
        code: a.code,
        rule: a.rule,
        severity: a.severity,
        state: a.state,
        summary: a.summary,
        detectedAt: a.detectedAt,
      })),
      corrections: await FuelEntryCorrectionService.toCorrectionRows(row.corrections),
    };
  }

  /** A records taker may only open entries they recorded. */
  static assertCanOpen(actor: Actor, recordedBy: string) {
    if (!SessionService.isAdmin(actor) && recordedBy !== actor.id) {
      throw new ForbiddenError("You can only open fuel entries you recorded.");
    }
  }

  /** Throws one `ValidationError` holding every field problem. Also used when approving corrections. */
  static validate(input: CreateFuelEntryInput, basis: Basis): void {
    const fields: Record<string, string> = {};

    if (typeof input.litres !== "number" || !Number.isFinite(input.litres) || input.litres <= 0) fields.litres = "Enter the litres dispensed";
    if (!isValidDate(input.dispensedAt)) fields.dispensedAt = "Enter a valid date and time";
    else if (isInFuture(input.dispensedAt)) fields.dispensedAt = "Can't be in the future";
    if (!input.locationActivity?.trim()) fields.locationActivity = "Enter the location or activity";

    const pairs = [
      { start: "odometerStart", end: "odometerEnd", basis: "km", label: "odometer" },
      { start: "hourMeterStart", end: "hourMeterEnd", basis: "hours", label: "hour meter" },
    ] as const;
    for (const pair of pairs) {
      const start = input[pair.start];
      const end = input[pair.end];
      if (start === null && end === null) {
        if (pair.basis === basis) fields[pair.start] = `Enter the ${pair.label} readings`;
        continue;
      }
      if (start === null || !Number.isFinite(start) || start < 0) fields[pair.start] = "Enter a valid start reading";
      if (end === null || !Number.isFinite(end) || end < 0) fields[pair.end] = "Enter a valid end reading";
      if (!fields[pair.start] && !fields[pair.end] && end! < start!) fields[pair.end] = "End reading can't be lower than start";
    }

    throwIfInvalid(fields);
  }

  static async create(input: CreateFuelEntryInput, actor: Actor): Promise<CreateFuelEntryResult> {
    // ---- Reads ----
    const equipment = await EquipmentService.getById(input.equipmentId).catch(nullIfNotFound);
    if (!equipment) throwIfInvalid({ equipmentId: "Pick the equipment" });
    const unit = equipment!;
    if (unit.status !== "active" && unit.status !== "idle") {
      throwIfInvalid({ equipmentId: `${unit.code} is ${unit.status === "retired" ? "retired" : "in maintenance"} and can't draw fuel.` });
    }

    let siteId = unit.siteId;
    if (!SessionService.isAdmin(actor)) {
      SessionService.assertSiteAccess(actor, unit.siteId);
      siteId = actor.siteId ?? unit.siteId;
    }

    FuelEntryService.validate(input, unit.type.basis);

    const [[tank], , unitCostGhs, operator, detection] = await Promise.all([
      db
        .select({ capacityL: vTankLevels.capacityL, currentL: vTankLevels.currentL, name: vTankLevels.name })
        .from(vTankLevels)
        .where(eq(vTankLevels.tankId, input.tankId)),
      ReportingPeriodService.assertOpen(input.dispensedAt),
      TankService.getLatestUnitCost(input.tankId),
      db.query.operators.findFirst({ columns: { id: true, isActive: true }, where: { id: input.operatorId } }),
      FuelEntryService.loadDetectionInputs(unit, input.dispensedAt, null),
    ]);

    if (!tank) throwIfInvalid({ tankId: "Pick a tanker" });
    const capacityL = Number(tank.capacityL);
    if (input.litres > capacityL) throwIfInvalid({ litres: `More than ${tank.name} holds (${formatLitres(capacityL)} L).` });
    if (!operator || !operator.isActive) throwIfInvalid({ operatorId: "Pick an active driver or operator" });

    // Dips lag behind real usage, so drawing more than the last dip is only a warning.
    const warnings: string[] = [];
    const currentL = Number(tank.currentL);
    if (input.litres > currentL) {
      warnings.push(`${tank.name} is only showing ${formatLitres(currentL)} L. Record a dip to check the real level.`);
    }

    // ---- Decide ----
    const id = crypto.randomUUID();
    const values = FuelEntryService.toColumnValues(input);
    const findings = AlertDetectionService.evaluate(FuelEntryService.buildContext(id, input, unit, detection));
    const status = AlertDetectionService.entryStatusFor(findings);

    // ---- Write (one batch) ----
    const writes: BatchWrites = [
      db
        .insert(fuelEntries)
        .values({
          id,
          ...values,
          equipmentId: input.equipmentId,
          tankId: input.tankId,
          siteId,
          unitCostGhs: toNumeric(unitCostGhs, 3),
          status,
          recordedBy: actor.id,
        })
        .returning({ id: fuelEntries.id, code: fuelEntries.code, status: fuelEntries.status }),
      ...FuelEntryService.alertWrites(findings, { entryId: id, equipmentId: unit.id, siteId }),
    ];

    const [[entry]] = (await db.batch(writes)) as [{ id: string; code: string; status: EntryStatus }[], ...unknown[]];
    return { entry, alerts: findings, warnings };
  }

  /**
   * An administrator's direct edit of a submitted entry — the same fields a correction can change.
   * Re-validates, re-runs detection, and raises alerts for any rule the edit newly breaks.
   * Records takers go through `FuelEntryCorrectionService.request` instead.
   */
  static async update(id: string, input: CreateFuelEntryInput, actor: Actor): Promise<{ status: EntryStatus }> {
    SessionService.assertAdmin(actor);

    const entry = await db.query.fuelEntries.findFirst({ where: { id } });
    if (!entry) throw new NotFoundError("Fuel entry");
    if (entry.voidedAt) throw new ConflictError("This entry is void. Restore it before editing.");

    const unit = await EquipmentService.getById(entry.equipmentId);
    FuelEntryService.validate(input, unit.type.basis);

    const operatorChanged = input.operatorId !== entry.operatorId;
    const [, , operator, detection] = await Promise.all([
      // Both months: the one it was in, and the one it's moving to.
      ReportingPeriodService.assertOpen(entry.dispensedAt),
      ReportingPeriodService.assertOpen(input.dispensedAt),
      operatorChanged
        ? db.query.operators.findFirst({ columns: { isActive: true }, where: { id: input.operatorId } })
        : Promise.resolve({ isActive: true }),
      FuelEntryService.loadDetectionInputs(unit, input.dispensedAt, id),
    ]);
    if (!operator?.isActive) throwIfInvalid({ operatorId: "Pick an active driver or operator" });

    const findings = AlertDetectionService.evaluate(FuelEntryService.buildContext(id, input, unit, detection));
    const status = AlertDetectionService.entryStatusFor(findings);
    const newFindings = await FuelEntryService.unalertedFindings(id, findings);

    const before = FuelEntryService.toColumnValues(toInput(entry));
    const after = FuelEntryService.toColumnValues(input);
    await db.batch([
      db.update(fuelEntries).set({ ...after, status }).where(eq(fuelEntries.id, id)),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.fuelEntryUpdate, "fuel_entries", id, { ...before, status: entry.status }, { ...after, status }),
      ...FuelEntryService.alertWrites(newFindings, { entryId: id, equipmentId: entry.equipmentId, siteId: entry.siteId }),
    ]);
    return { status };
  }

  /**
   * Voids an entry recorded in error, or restores one. A void entry stays in the log but is ignored by
   * stock, costs, the monthly summary and the dashboard, so past figures are never rewritten silently.
   */
  static async setVoided(id: string, input: { voided: boolean; reason?: string }, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);

    const entry = await db.query.fuelEntries.findFirst({
      columns: { id: true, code: true, litres: true, dispensedAt: true, voidedAt: true },
      where: { id },
    });
    if (!entry) throw new NotFoundError("Fuel entry");
    if (Boolean(entry.voidedAt) === input.voided) return;

    await ReportingPeriodService.assertOpen(entry.dispensedAt);

    const reason = input.reason?.trim() ?? "";
    if (input.voided) throwIfInvalid(reason ? {} : { reason: "Say why it's being voided" });

    const after = input.voided
      ? { voidedAt: new Date(), voidedBy: actor.id, voidReason: reason }
      : { voidedAt: null, voidedBy: null, voidReason: null };

    await db.batch([
      db.update(fuelEntries).set(after).where(eq(fuelEntries.id, id)),
      AuditLogService.entry(
        actor.id,
        input.voided ? AUDIT_ACTIONS.fuelEntryVoid : AUDIT_ACTIONS.fuelEntryRestore,
        "fuel_entries",
        id,
        { code: entry.code, litres: Number(entry.litres), voidedAt: entry.voidedAt },
        after
      ),
    ]);
  }

  /** Findings for rules this entry hasn't already raised an alert for — so a re-check can't duplicate them. */
  static async unalertedFindings(entryId: string, findings: Finding[]): Promise<Finding[]> {
    if (findings.length === 0) return [];
    const existing = await db
      .select({ rule: theftAlerts.rule })
      .from(theftAlerts)
      .innerJoin(alertFuelEntries, eq(alertFuelEntries.alertId, theftAlerts.id))
      .where(eq(alertFuelEntries.fuelEntryId, entryId));
    const known = new Set(existing.map((a) => a.rule));
    return findings.filter((f) => !known.has(f.rule));
  }

  /**
   * The daily fuel log as CSV, with the same columns as the register on screen.
   * Serve it from a Route Handler that gets the actor, so a records taker only exports their own entries.
   */
  static async toCsv(options: FuelEntryListOptions & { ids?: string[] }): Promise<string> {
    const rows = await FuelEntryService.listRecent({ ...options, limit: options.limit ?? 1000 });
    const wanted = options.ids?.length ? rows.filter((r) => options.ids!.includes(r.id)) : rows;

    const lines = wanted.map((r) => [
      formatDateTime(r.dispensedAt),
      r.code,
      r.equipmentCode,
      r.equipmentType,
      r.operatorName,
      r.litres,
      r.odometerStart,
      r.odometerEnd,
      r.totalKm,
      r.lPerKm,
      r.hourMeterStart,
      r.hourMeterEnd,
      r.totalHours,
      r.lPerHr,
      r.locationActivity,
      r.siteName,
      r.recordedBy,
      r.voidedAt ? "Void" : r.status[0].toUpperCase() + r.status.slice(1),
    ]);
    return [CSV_HEADERS, ...lines].map((line) => line.map(csvCell).join(",")).join("\r\n");
  }

  /** Numeric column values for the editable fields of an entry. */
  static toColumnValues(input: CreateFuelEntryInput) {
    return {
      dispensedAt: input.dispensedAt,
      operatorId: input.operatorId,
      litres: toNumeric(input.litres),
      odometerStart: toNumericOrNull(input.odometerStart, 1),
      odometerEnd: toNumericOrNull(input.odometerEnd, 1),
      hourMeterStart: toNumericOrNull(input.hourMeterStart, 1),
      hourMeterEnd: toNumericOrNull(input.hourMeterEnd, 1),
      locationActivity: input.locationActivity.trim(),
    };
  }

  /** The effective standard, thresholds, and the unit's entries in the 24 h before `dispensedAt`. */
  static async loadDetectionInputs(unit: EquipmentDetail, dispensedAt: Date, excludeEntryId: string | null) {
    const [standard, thresholds, previous] = await Promise.all([
      EquipmentService.getEffectiveStandard(unit.id),
      AlertThresholdService.getMap(),
      db.query.fuelEntries.findMany({
        columns: { id: true, dispensedAt: true, litres: true, odometerEnd: true, hourMeterEnd: true },
        where: {
          equipmentId: unit.id,
          dispensedAt: { gte: new Date(dispensedAt.getTime() - DAY_MS), lte: dispensedAt },
          ...(excludeEntryId ? { id: { ne: excludeEntryId } } : {}),
        },
        orderBy: { dispensedAt: "desc" },
      }),
    ]);
    return {
      standard,
      thresholds,
      previousEntries: previous.map((p) => ({
        id: p.id,
        dispensedAt: p.dispensedAt,
        litres: Number(p.litres),
        odometerEnd: toNumber(p.odometerEnd),
        hourMeterEnd: toNumber(p.hourMeterEnd),
      })),
    };
  }

  static buildContext(
    entryId: string,
    input: CreateFuelEntryInput,
    unit: EquipmentDetail,
    detection: Awaited<ReturnType<typeof FuelEntryService.loadDetectionInputs>>
  ): DetectionContext {
    const diff = (start: number | null, end: number | null) => (start === null || end === null ? null : round(end - start, 1));
    return {
      entry: {
        id: entryId,
        dispensedAt: input.dispensedAt,
        litres: input.litres,
        totalKm: diff(input.odometerStart, input.odometerEnd),
        totalHours: diff(input.hourMeterStart, input.hourMeterEnd),
        odometerStart: input.odometerStart,
        hourMeterStart: input.hourMeterStart,
      },
      equipment: {
        id: unit.id,
        code: unit.code,
        typeName: unit.type.name,
        siteId: unit.siteId,
        basis: detection.standard.basis,
        lKmStandard: detection.standard.lKmStandard,
        lHrStandard: detection.standard.lHrStandard,
        fuelTankCapacityL: unit.fuelTankCapacityL,
      },
      thresholds: detection.thresholds,
      previousEntries: detection.previousEntries,
    };
  }

  /** A `theft_alerts` row per finding, linked to the entry and every related entry. */
  static alertWrites(findings: Finding[], target: { entryId: string; equipmentId: string; siteId: string }) {
    const detectedAt = new Date();
    return findings.flatMap((finding) => {
      const alertId = crypto.randomUUID();
      const entryIds = [...new Set([target.entryId, ...finding.relatedEntryIds])];
      return [
        db.insert(theftAlerts).values({
          id: alertId,
          equipmentId: target.equipmentId,
          siteId: target.siteId,
          rule: finding.rule,
          severity: finding.severity,
          variancePct: toNumericOrNull(finding.variancePct),
          summary: finding.summary,
          detectedAt,
        }),
        db.insert(alertFuelEntries).values(entryIds.map((fuelEntryId) => ({ alertId, fuelEntryId }))),
      ];
    });
  }
}

/** The editable fields of a stored entry, in the shape `validate` and `toColumnValues` expect. */
function toInput(entry: typeof fuelEntries.$inferSelect): CreateFuelEntryInput {
  return {
    dispensedAt: entry.dispensedAt,
    equipmentId: entry.equipmentId,
    tankId: entry.tankId,
    operatorId: entry.operatorId,
    litres: Number(entry.litres),
    odometerStart: toNumber(entry.odometerStart),
    odometerEnd: toNumber(entry.odometerEnd),
    hourMeterStart: toNumber(entry.hourMeterStart),
    hourMeterEnd: toNumber(entry.hourMeterEnd),
    locationActivity: entry.locationActivity,
  };
}
