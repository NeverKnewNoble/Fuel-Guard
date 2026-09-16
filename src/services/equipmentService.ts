import { type SQL, and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { equipment, sites, vEquipmentStandards } from "@/db/schema";
import type {
  CreateEquipmentInput,
  EffectiveStandard,
  EquipmentDetail,
  EquipmentFilters,
  EquipmentFormOption,
  EquipmentRecordStatus,
  EquipmentRow,
  EquipmentStats,
} from "@/types/equipment";
import type { Basis } from "@/types/standards";
import type { Actor } from "@/types/user";

import { AUDIT_ACTIONS, AuditLogService } from "./auditLogService";
import { ConflictError, NotFoundError, isUniqueViolation, nullIfNotFound, throwIfInvalid } from "./errors";
import { EquipmentTypeService } from "./equipmentTypeService";
import { SessionService } from "./sessionService";
import { SiteService } from "./siteService";
import { isPositive, toNumber, toNumeric, toNumericOrNull } from "./utils";

const STATUSES: EquipmentRecordStatus[] = ["active", "maintenance", "idle", "retired"];

export class EquipmentService {
  static async list(filters: EquipmentFilters = {}): Promise<EquipmentRow[]> {
    const conditions: (SQL | undefined)[] = [
      filters.siteId ? eq(vEquipmentStandards.siteId, filters.siteId) : undefined,
      filters.status ? eq(vEquipmentStandards.status, filters.status) : undefined,
      filters.typeId ? eq(vEquipmentStandards.equipmentTypeId, filters.typeId) : undefined,
    ];
    const term = filters.search?.trim();
    if (term) {
      const pattern = `%${term}%`;
      conditions.push(
        or(
          ilike(vEquipmentStandards.equipmentCode, pattern),
          ilike(vEquipmentStandards.makeModel, pattern),
          ilike(vEquipmentStandards.typeName, pattern)
        )
      );
    }

    // Views have no relations, so join the site name in by hand.
    const rows = await db
      .select({
        id: vEquipmentStandards.equipmentId,
        code: vEquipmentStandards.equipmentCode,
        typeName: vEquipmentStandards.typeName,
        basis: vEquipmentStandards.basis,
        makeModel: vEquipmentStandards.makeModel,
        siteId: vEquipmentStandards.siteId,
        siteName: sites.name,
        status: vEquipmentStandards.status,
        lKmStandard: vEquipmentStandards.lKmStandard,
        lHrStandard: vEquipmentStandards.lHrStandard,
      })
      .from(vEquipmentStandards)
      .innerJoin(sites, eq(sites.id, vEquipmentStandards.siteId))
      .where(and(...conditions))
      .orderBy(asc(vEquipmentStandards.equipmentCode));

    return rows.map(({ lKmStandard, lHrStandard, ...row }) => ({
      ...row,
      lKmStd: toNumber(lKmStandard),
      lHrStd: toNumber(lHrStandard),
    }));
  }

  /** The Dashboard shows `active`, and `maintenance + idle` as "idle / maintenance". */
  static async getStats(): Promise<EquipmentStats> {
    const countWhere = (status: EquipmentRecordStatus) =>
      sql<number>`count(*) filter (where ${equipment.status} = ${status})`.mapWith(Number);
    const [row] = await db
      .select({
        active: countWhere("active"),
        maintenance: countWhere("maintenance"),
        idle: countWhere("idle"),
        retired: countWhere("retired"),
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(equipment);
    return row ?? { active: 0, maintenance: 0, idle: 0, retired: 0, total: 0 };
  }

  static async getById(id: string): Promise<EquipmentDetail> {
    const row = await db.query.equipment.findFirst({
      where: { id },
      with: { type: true, site: { columns: { id: true, code: true, name: true } } },
    });
    if (!row) throw new NotFoundError("Equipment");
    return {
      id: row.id,
      code: row.code,
      makeModel: row.makeModel,
      registrationNo: row.registrationNo,
      status: row.status,
      siteId: row.siteId,
      equipmentTypeId: row.equipmentTypeId,
      fuelTankCapacityL: toNumber(row.fuelTankCapacityL),
      lKmStandardOverride: toNumber(row.lKmStandardOverride),
      lHrStandardOverride: toNumber(row.lHrStandardOverride),
      type: {
        id: row.type.id,
        name: row.type.name,
        basis: row.type.basis,
        lKmStandard: toNumber(row.type.lKmStandard),
        lHrStandard: toNumber(row.type.lHrStandard),
      },
      site: row.site,
    };
  }

  /** Override ?? type default, from `v_equipment_standards`. */
  static async getEffectiveStandard(id: string): Promise<EffectiveStandard> {
    const [row] = await db
      .select({ basis: vEquipmentStandards.basis, lKm: vEquipmentStandards.lKmStandard, lHr: vEquipmentStandards.lHrStandard })
      .from(vEquipmentStandards)
      .where(eq(vEquipmentStandards.equipmentId, id));
    if (!row) throw new NotFoundError("Equipment");
    return { basis: row.basis, lKmStandard: toNumber(row.lKm), lHrStandard: toNumber(row.lHr) };
  }

  /** Units that can draw fuel (`active` or `idle`). A records taker only sees their own site. */
  static async listForEntryForm(actor: Actor): Promise<EquipmentFormOption[]> {
    const siteScope = !SessionService.isAdmin(actor) && actor.siteId ? eq(vEquipmentStandards.siteId, actor.siteId) : undefined;
    const rows = await db
      .select({
        id: vEquipmentStandards.equipmentId,
        code: vEquipmentStandards.equipmentCode,
        typeName: vEquipmentStandards.typeName,
        basis: vEquipmentStandards.basis,
        siteId: vEquipmentStandards.siteId,
      })
      .from(vEquipmentStandards)
      .where(and(inArray(vEquipmentStandards.status, ["active", "idle"]), siteScope))
      .orderBy(asc(vEquipmentStandards.equipmentCode));
    return rows.map((r) => ({ ...r, label: `${r.code} — ${r.typeName}` }));
  }

  static async create(input: CreateEquipmentInput, actor: Actor): Promise<{ id: string; code: string }> {
    SessionService.assertAdmin(actor);

    const [type] = await Promise.all([
      EquipmentTypeService.getById(input.equipmentTypeId).catch(nullIfNotFound),
      SiteService.assertActive(input.siteId),
    ]);

    const fields: Record<string, string> = {};
    if (!type) fields.equipmentTypeId = "Pick an equipment type";
    const makeModel = input.makeModel.trim();
    if (!makeModel) fields.makeModel = "Enter the make and model";
    if (!isNullish(input.fuelTankCapacityL) && !isPositive(input.fuelTankCapacityL)) fields.fuelTankCapacityL = "Must be above 0";
    const overrides = type ? resolveOverrides(type, input.lKmStandardOverride, input.lHrStandardOverride, fields) : null;
    throwIfInvalid(fields);

    const code = input.code?.trim().toUpperCase() || undefined;
    const values = {
      equipmentTypeId: input.equipmentTypeId,
      makeModel,
      registrationNo: input.registrationNo?.trim() || null,
      siteId: input.siteId,
      fuelTankCapacityL: toNumericOrNull(input.fuelTankCapacityL),
      ...overrides!,
    };

    const id = crypto.randomUUID();
    try {
      const [[created]] = await db.batch([
        // Leave `code` out when it wasn't typed, so the sequence generates EQ-###.
        db.insert(equipment).values({ id, ...(code ? { code } : {}), ...values }).returning({ id: equipment.id, code: equipment.code }),
        AuditLogService.entry(actor.id, AUDIT_ACTIONS.equipmentCreate, "equipment", id, null, { code: code ?? null, ...values }),
      ]);
      return created;
    } catch (error) {
      throw friendlyUniqueError(error);
    }
  }

  static async update(id: string, input: Partial<CreateEquipmentInput>, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const current = await EquipmentService.getById(id);

    const typeChanged = input.equipmentTypeId !== undefined && input.equipmentTypeId !== current.equipmentTypeId;
    const type = typeChanged ? await EquipmentTypeService.getById(input.equipmentTypeId!).catch(nullIfNotFound) : current.type;
    if (input.siteId !== undefined && input.siteId !== current.siteId) await SiteService.assertActive(input.siteId);

    const fields: Record<string, string> = {};
    if (!type) fields.equipmentTypeId = "Pick an equipment type";
    const makeModel = input.makeModel !== undefined ? input.makeModel.trim() : current.makeModel;
    if (!makeModel) fields.makeModel = "Enter the make and model";
    const capacity = input.fuelTankCapacityL !== undefined ? input.fuelTankCapacityL : current.fuelTankCapacityL;
    if (!isNullish(capacity) && !isPositive(capacity)) fields.fuelTankCapacityL = "Must be above 0";

    // Changing the type resets both overrides unless new ones are given.
    const lKm = input.lKmStandardOverride !== undefined ? input.lKmStandardOverride : typeChanged ? null : current.lKmStandardOverride;
    const lHr = input.lHrStandardOverride !== undefined ? input.lHrStandardOverride : typeChanged ? null : current.lHrStandardOverride;
    const overrides = type ? resolveOverrides(type, lKm, lHr, fields) : null;
    throwIfInvalid(fields);

    const next = {
      code: input.code !== undefined ? input.code.trim().toUpperCase() || current.code : current.code,
      equipmentTypeId: type!.id,
      makeModel,
      registrationNo: input.registrationNo !== undefined ? input.registrationNo?.trim() || null : current.registrationNo,
      siteId: input.siteId ?? current.siteId,
      fuelTankCapacityL: toNumericOrNull(capacity),
      ...overrides!,
    };
    const before = {
      code: current.code,
      equipmentTypeId: current.equipmentTypeId,
      makeModel: current.makeModel,
      registrationNo: current.registrationNo,
      siteId: current.siteId,
      fuelTankCapacityL: toNumericOrNull(current.fuelTankCapacityL),
      lKmStandardOverride: toNumericOrNull(current.lKmStandardOverride, 3),
      lHrStandardOverride: toNumericOrNull(current.lHrStandardOverride, 2),
    };
    const changes = Object.fromEntries(
      Object.entries(next).filter(([key, value]) => before[key as keyof typeof before] !== value)
    ) as Partial<typeof next>;
    if (Object.keys(changes).length === 0) return;

    try {
      await db.batch([
        db.update(equipment).set(changes).where(eq(equipment.id, id)),
        AuditLogService.entry(actor.id, AUDIT_ACTIONS.equipmentUpdate, "equipment", id, before, next),
      ]);
    } catch (error) {
      throw friendlyUniqueError(error);
    }
  }

  /** Retired units stay in history but vanish from forms and the monthly summary. */
  static async setStatus(id: string, status: EquipmentRecordStatus, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    throwIfInvalid(STATUSES.includes(status) ? {} : { status: "Pick a status" });
    const current = await EquipmentService.getById(id);
    if (current.status === status) return;

    await db.batch([
      db.update(equipment).set({ status }).where(eq(equipment.id, id)),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.equipmentStatusChange, "equipment", id, { status: current.status }, { status }),
    ]);
  }

  /** Past fuel entries keep their own `site_id` snapshot, so history is unaffected. */
  static async moveToSite(id: string, siteId: string, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const current = await EquipmentService.getById(id);
    if (current.siteId === siteId) return;
    await SiteService.assertActive(siteId);

    await db.batch([
      db.update(equipment).set({ siteId }).where(eq(equipment.id, id)),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.equipmentUpdate, "equipment", id, { siteId: current.siteId }, { siteId }),
    ]);
  }
}

const isNullish = (v: unknown): v is null | undefined => v === null || v === undefined;

/**
 * A standard override is stored only when it differs from the type default, so later changes to the type still
 * apply. A value for the wrong basis is a validation error. Adds problems to `fields`.
 */
function resolveOverrides(
  type: { basis: Basis; lKmStandard: number | null; lHrStandard: number | null },
  lKm: number | null | undefined,
  lHr: number | null | undefined,
  fields: Record<string, string>
) {
  const wrongBasis = type.basis === "km" ? lHr : lKm;
  if (!isNullish(wrongBasis)) {
    if (type.basis === "km") fields.lHrStandardOverride = "Odometer types use an L/km standard";
    else fields.lKmStandardOverride = "Hour-meter types use an L/hr standard";
  }

  const [value, field, fallback, scale] =
    type.basis === "km"
      ? [lKm, "lKmStandardOverride", type.lKmStandard, 3]
      : [lHr, "lHrStandardOverride", type.lHrStandard, 2];

  let stored: string | null = null;
  if (!isNullish(value)) {
    if (!isPositive(value)) fields[field] = "Must be above 0";
    else if (fallback === null || toNumeric(value, scale) !== toNumeric(fallback, scale)) stored = toNumeric(value, scale);
  }

  return {
    lKmStandardOverride: type.basis === "km" ? stored : null,
    lHrStandardOverride: type.basis === "hours" ? stored : null,
  };
}

function friendlyUniqueError(error: unknown) {
  if (isUniqueViolation(error, "equipment_code_key")) return new ConflictError("That equipment ID is already used.");
  if (isUniqueViolation(error, "equipment_registration_no_key")) return new ConflictError("That registration is already used.");
  return error;
}
