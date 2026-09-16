import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { alertFuelEntries, fuelEntries, fuelEntryCorrections, operators, theftAlerts } from "@/db/schema";
import type {
  CorrectableField,
  CorrectionChangeLine,
  CorrectionChanges,
  CorrectionRequestInput,
  CorrectionRow,
  CreateFuelEntryInput,
  PendingCorrectionRow,
} from "@/types/fuelLog";
import type { Actor } from "@/types/user";

import { AUDIT_ACTIONS, AuditLogService } from "./auditLogService";
import { AlertDetectionService } from "./alertDetectionService";
import { EquipmentService } from "./equipmentService";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, throwIfInvalid } from "./errors";
import { FuelEntryService } from "./fuelEntryService";
import { ReportingPeriodService } from "./reportingPeriodService";
import { SessionService } from "./sessionService";
import { type BatchWrites, TIME_ZONE, isValidDate, round, toNumber } from "./utils";

/** Equipment and tank can't be corrected; those need a new entry. */
export const CORRECTABLE_FIELDS = [
  "dispensedAt",
  "operatorId",
  "litres",
  "odometerStart",
  "odometerEnd",
  "hourMeterStart",
  "hourMeterEnd",
  "locationActivity",
] as const satisfies readonly CorrectableField[];

const LABELS: Record<CorrectableField, string> = {
  dispensedAt: "Date & time",
  operatorId: "Driver / operator",
  litres: "Litres",
  odometerStart: "Odometer start",
  odometerEnd: "Odometer end",
  hourMeterStart: "Hour meter start",
  hourMeterEnd: "Hour meter end",
  locationActivity: "Location / activity",
};

const NUMERIC_SCALE: Partial<Record<CorrectableField, number>> = {
  litres: 2,
  odometerStart: 1,
  odometerEnd: 1,
  hourMeterStart: 1,
  hourMeterEnd: 1,
};

type EntryRow = typeof fuelEntries.$inferSelect;
type CorrectionWithPeople = typeof fuelEntryCorrections.$inferSelect & {
  requester: { id: string; name: string };
  reviewer: { id: string; name: string } | null;
};

export class FuelEntryCorrectionService {
  static async request(input: CorrectionRequestInput, actor: Actor): Promise<{ id: string }> {
    const entry = await db.query.fuelEntries.findFirst({ where: { id: input.fuelEntryId } });
    if (!entry) throw new NotFoundError("Fuel entry");
    if (!SessionService.isAdmin(actor) && entry.recordedBy !== actor.id) {
      throw new ForbiddenError("You can only correct fuel entries you recorded.");
    }
    if (entry.voidedAt) throw new ConflictError("This entry is void. An administrator can restore it first.");

    const current = currentValues(entry);
    const changes: CorrectionChanges = {};
    const fields: Record<string, string> = {};
    for (const field of CORRECTABLE_FIELDS) {
      const raw = input.changes[field];
      if (raw === undefined) continue;
      const parsed = normalize(field, raw);
      if (!parsed.ok) {
        fields[field] = parsed.message;
        continue;
      }
      if (parsed.value !== current[field]) changes[field] = { from: current[field], to: parsed.value };
    }
    const reason = input.reason.trim();
    if (!reason) fields.reason = "Explain why the entry needs correcting";
    throwIfInvalid(fields);
    if (Object.keys(changes).length === 0) throw new ValidationError("Nothing to change.");

    const pending = await db.query.fuelEntryCorrections.findFirst({
      columns: { id: true },
      where: { fuelEntryId: entry.id, status: "pending" },
    });
    if (pending) throw new ConflictError("A correction is already waiting for approval.");

    await ReportingPeriodService.assertOpen(entry.dispensedAt);

    const [created] = await db
      .insert(fuelEntryCorrections)
      .values({ fuelEntryId: entry.id, changes, reason, requestedBy: actor.id })
      .returning({ id: fuelEntryCorrections.id });
    return created;
  }

  /** Oldest first, so the longest-waiting request is reviewed first. */
  static async listPending(actor: Actor): Promise<PendingCorrectionRow[]> {
    SessionService.assertAdmin(actor);
    const rows = await db.query.fuelEntryCorrections.findMany({
      where: { status: "pending" },
      with: {
        fuelEntry: { columns: { code: true }, with: { equipment: { columns: { code: true } } } },
        requester: { columns: { id: true, name: true } },
        reviewer: { columns: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    const mapped = await FuelEntryCorrectionService.toCorrectionRows(rows);
    return mapped.map((row, i) => ({
      ...row,
      entryCode: rows[i].fuelEntry.code,
      equipmentCode: rows[i].fuelEntry.equipment.code,
    }));
  }

  /** History under an entry, newest first. Same access rule as `FuelEntryService.getById`. */
  static async listForEntry(fuelEntryId: string, actor: Actor): Promise<CorrectionRow[]> {
    const entry = await db.query.fuelEntries.findFirst({ columns: { recordedBy: true }, where: { id: fuelEntryId } });
    if (!entry) throw new NotFoundError("Fuel entry");
    FuelEntryService.assertCanOpen(actor, entry.recordedBy);

    const rows = await db.query.fuelEntryCorrections.findMany({
      where: { fuelEntryId },
      with: { requester: { columns: { id: true, name: true } }, reviewer: { columns: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return FuelEntryCorrectionService.toCorrectionRows(rows);
  }

  /** Applies the change, re-validates, re-runs detection, and raises alerts for any new findings. Old alerts stay as history. */
  static async approve(correctionId: string, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const correction = await db.query.fuelEntryCorrections.findFirst({ where: { id: correctionId }, with: { fuelEntry: true } });
    if (!correction) throw new NotFoundError("Correction");
    if (correction.status !== "pending") throw new ConflictError("This correction has already been reviewed.");

    const entry = correction.fuelEntry;
    if (entry.voidedAt) throw new ConflictError("That entry is void. Restore it before approving a correction.");
    const before = toInput(entry);
    const corrected = applyChanges(before, correction.changes);

    const unit = await EquipmentService.getById(entry.equipmentId);
    FuelEntryService.validate(corrected, unit.type.basis);

    const operatorChanged = corrected.operatorId !== before.operatorId;
    const [, , operator, detection, existingAlerts] = await Promise.all([
      ReportingPeriodService.assertOpen(before.dispensedAt),
      ReportingPeriodService.assertOpen(corrected.dispensedAt),
      operatorChanged
        ? db.query.operators.findFirst({ columns: { isActive: true }, where: { id: corrected.operatorId } })
        : Promise.resolve({ isActive: true }),
      FuelEntryService.loadDetectionInputs(unit, corrected.dispensedAt, entry.id),
      db
        .select({ rule: theftAlerts.rule })
        .from(theftAlerts)
        .innerJoin(alertFuelEntries, eq(alertFuelEntries.alertId, theftAlerts.id))
        .where(eq(alertFuelEntries.fuelEntryId, entry.id)),
    ]);
    if (!operator?.isActive) throwIfInvalid({ operatorId: "Pick an active driver or operator" });

    const findings = AlertDetectionService.evaluate(FuelEntryService.buildContext(entry.id, corrected, unit, detection));
    const status = AlertDetectionService.entryStatusFor(findings);
    const knownRules = new Set(existingAlerts.map((a) => a.rule));
    const newFindings = findings.filter((f) => !knownRules.has(f.rule));

    const writes: BatchWrites = [
      db
        .update(fuelEntries)
        .set({ ...FuelEntryService.toColumnValues(corrected), status })
        .where(eq(fuelEntries.id, entry.id)),
      db
        .update(fuelEntryCorrections)
        .set({ status: "approved", reviewedBy: actor.id, reviewedAt: new Date() })
        .where(eq(fuelEntryCorrections.id, correctionId)),
      AuditLogService.entry(
        actor.id,
        AUDIT_ACTIONS.fuelEntryCorrect,
        "fuel_entries",
        entry.id,
        { ...currentValues(entry), status: entry.status },
        { ...currentValues({ ...entry, ...FuelEntryService.toColumnValues(corrected) }), status, correctionId }
      ),
      ...FuelEntryService.alertWrites(newFindings, { entryId: entry.id, equipmentId: entry.equipmentId, siteId: entry.siteId }),
    ];
    await db.batch(writes);
  }

  static async reject(correctionId: string, note: string, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const trimmed = note.trim();
    throwIfInvalid(trimmed ? {} : { note: "Explain why the correction is rejected" });

    const correction = await db.query.fuelEntryCorrections.findFirst({
      columns: { id: true, status: true, fuelEntryId: true },
      where: { id: correctionId },
    });
    if (!correction) throw new NotFoundError("Correction");
    if (correction.status !== "pending") throw new ConflictError("This correction has already been reviewed.");

    await db.batch([
      db
        .update(fuelEntryCorrections)
        .set({ status: "rejected", reviewedBy: actor.id, reviewedAt: new Date() })
        .where(eq(fuelEntryCorrections.id, correctionId)),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.fuelEntryCorrectionRejected, "fuel_entries", correction.fuelEntryId, { status: "pending" }, {
        correctionId,
        status: "rejected",
        note: trimmed,
      }),
    ]);
  }

  /** Turns stored `changes` into readable lines ("Litres: 210 → 201"), resolving operator ids to names. */
  static async toCorrectionRows(rows: CorrectionWithPeople[]): Promise<CorrectionRow[]> {
    const operatorIds = new Set<string>();
    for (const row of rows) {
      const change = row.changes.operatorId;
      if (typeof change?.from === "string") operatorIds.add(change.from);
      if (typeof change?.to === "string") operatorIds.add(change.to);
    }
    const names = new Map<string, string>();
    if (operatorIds.size > 0) {
      const found = await db.select({ id: operators.id, name: operators.name }).from(operators).where(inArray(operators.id, [...operatorIds]));
      for (const o of found) names.set(o.id, o.name);
    }

    return rows.map((row) => ({
      id: row.id,
      fuelEntryId: row.fuelEntryId,
      status: row.status,
      reason: row.reason,
      changes: CORRECTABLE_FIELDS.filter((field) => row.changes[field]).map((field) => {
        const { from, to } = row.changes[field]!;
        return describeChange(field, from, to, names);
      }),
      requestedBy: row.requester,
      reviewedBy: row.reviewer,
      reviewedAt: row.reviewedAt,
      createdAt: row.createdAt,
    }));
  }
}

/** The correctable fields of an entry in the shape stored in `changes` (numbers, ISO date string). */
function currentValues(entry: Pick<EntryRow, CorrectableField>): Record<CorrectableField, string | number | null> {
  return {
    dispensedAt: entry.dispensedAt.toISOString(),
    operatorId: entry.operatorId,
    litres: Number(entry.litres),
    odometerStart: toNumber(entry.odometerStart),
    odometerEnd: toNumber(entry.odometerEnd),
    hourMeterStart: toNumber(entry.hourMeterStart),
    hourMeterEnd: toNumber(entry.hourMeterEnd),
    locationActivity: entry.locationActivity,
  };
}

type Parsed = { ok: true; value: string | number | null } | { ok: false; message: string };

function normalize(field: CorrectableField, raw: unknown): Parsed {
  const scale = NUMERIC_SCALE[field];
  if (scale !== undefined) {
    if (raw === null || raw === "") return field === "litres" ? { ok: false, message: "Enter the litres dispensed" } : { ok: true, value: null };
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) && n >= 0 ? { ok: true, value: round(n, scale) } : { ok: false, message: "Enter a valid number" };
  }
  if (field === "dispensedAt") {
    const date = raw instanceof Date ? raw : new Date(String(raw));
    return isValidDate(date) ? { ok: true, value: date.toISOString() } : { ok: false, message: "Enter a valid date and time" };
  }
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { ok: false, message: field === "operatorId" ? "Pick a driver or operator" : "Enter the location or activity" };
  return { ok: true, value: text };
}

function toInput(entry: EntryRow): CreateFuelEntryInput {
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

function applyChanges(input: CreateFuelEntryInput, changes: CorrectionChanges): CreateFuelEntryInput {
  const next = { ...input };
  for (const field of CORRECTABLE_FIELDS) {
    const change = changes[field];
    if (!change) continue;
    const to = change.to;
    switch (field) {
      case "dispensedAt":
        next.dispensedAt = new Date(String(to));
        break;
      case "operatorId":
      case "locationActivity":
        next[field] = String(to);
        break;
      case "litres":
        // `validate` rejects NaN, so a missing value can't slip through.
        next.litres = to === null ? Number.NaN : Number(to);
        break;
      default:
        next[field] = to === null ? null : Number(to);
    }
  }
  return next;
}

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function describeChange(field: CorrectableField, from: unknown, to: unknown, operatorNames: Map<string, string>): CorrectionChangeLine {
  const show = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (field === "dispensedAt") return dateTimeFormat.format(new Date(String(v)));
    if (field === "operatorId") return operatorNames.get(String(v)) ?? "Unknown operator";
    return String(v);
  };
  const label = LABELS[field];
  const fromText = show(from);
  const toText = show(to);
  return { field, label, from: fromText, to: toText, text: `${label}: ${fromText} → ${toText}` };
}
