import { asc, count, eq } from "drizzle-orm";

import { db } from "@/db";
import { equipment, equipmentTypes } from "@/db/schema";
import type {
  Basis,
  CreateEquipmentTypeInput,
  EquipmentTypeDetail,
  EquipmentTypeRow,
  MeasurementBasis,
  UpdateStandardInput,
} from "@/types/standards";
import type { Actor } from "@/types/user";

import { AUDIT_ACTIONS, AuditLogService } from "./auditLogService";
import { ConflictError, NotFoundError, isUniqueViolation, throwIfInvalid } from "./errors";
import { SessionService } from "./sessionService";
import { isPositive, toNumber, toNumeric } from "./utils";

const NAME_CONSTRAINT = "equipment_types_name_key";

export const measurementLabel = (basis: Basis): MeasurementBasis => (basis === "hours" ? "Hour meter (hrs)" : "Odometer (km)");

export class EquipmentTypeService {
  static async list(): Promise<EquipmentTypeRow[]> {
    const rows = await db
      .select({
        id: equipmentTypes.id,
        name: equipmentTypes.name,
        basis: equipmentTypes.basis,
        lKmStandard: equipmentTypes.lKmStandard,
        lHrStandard: equipmentTypes.lHrStandard,
        unitCount: count(equipment.id),
      })
      .from(equipmentTypes)
      .leftJoin(equipment, eq(equipment.equipmentTypeId, equipmentTypes.id))
      .groupBy(equipmentTypes.id)
      .orderBy(asc(equipmentTypes.name));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      basis: r.basis,
      measurementLabel: measurementLabel(r.basis),
      lKmStandard: toNumber(r.lKmStandard),
      lHrStandard: toNumber(r.lHrStandard),
      unitCount: r.unitCount,
    }));
  }

  static async getById(id: string): Promise<EquipmentTypeDetail> {
    const row = await db.query.equipmentTypes.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("Equipment type");
    return {
      id: row.id,
      name: row.name,
      basis: row.basis,
      lKmStandard: toNumber(row.lKmStandard),
      lHrStandard: toNumber(row.lHrStandard),
    };
  }

  static async create(input: CreateEquipmentTypeInput, actor: Actor): Promise<{ id: string; name: string }> {
    SessionService.assertAdmin(actor);

    const name = input.name.trim();
    const fields: Record<string, string> = name ? {} : { name: "Enter a type name" };
    const standard = checkStandard(input, fields);
    throwIfInvalid(fields);

    const id = crypto.randomUUID();
    try {
      const [[created]] = await db.batch([
        db
          .insert(equipmentTypes)
          .values({ id, name, basis: input.basis, ...standard })
          .returning({ id: equipmentTypes.id, name: equipmentTypes.name }),
        AuditLogService.entry(actor.id, AUDIT_ACTIONS.standardCreate, "equipment_types", id, null, {
          name,
          basis: input.basis,
          lKmStandard: toNumber(standard.lKmStandard),
          lHrStandard: toNumber(standard.lHrStandard),
        }),
      ]);
      return created;
    } catch (error) {
      if (isUniqueViolation(error, NAME_CONSTRAINT)) throw new ConflictError("An equipment type with that name already exists.");
      throw error;
    }
  }

  /** Existing alerts aren't recalculated; only new fuel entries use the new standard — say so in the success message. */
  static async updateStandard(id: string, input: UpdateStandardInput, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const current = await EquipmentTypeService.getById(id);

    const fields: Record<string, string> = {};
    const standard = checkStandard(input, fields);
    throwIfInvalid(fields);

    const after = { basis: input.basis, lKmStandard: toNumber(standard.lKmStandard), lHrStandard: toNumber(standard.lHrStandard) };
    const before = { basis: current.basis, lKmStandard: current.lKmStandard, lHrStandard: current.lHrStandard };
    if (before.basis === after.basis && before.lKmStandard === after.lKmStandard && before.lHrStandard === after.lHrStandard) return;

    await db.batch([
      // The unused standard is always written as null, so switching basis clears it.
      db.update(equipmentTypes).set({ basis: input.basis, ...standard }).where(eq(equipmentTypes.id, id)),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.standardUpdate, "equipment_types", id, before, after),
    ]);
  }

  static async remove(id: string, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const current = await EquipmentTypeService.getById(id);

    const units = await db.$count(equipment, eq(equipment.equipmentTypeId, id));
    if (units > 0) throw new ConflictError(`${units} unit${units === 1 ? " uses" : "s use"} this type.`);

    await db.batch([
      db.delete(equipmentTypes).where(eq(equipmentTypes.id, id)),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.standardDelete, "equipment_types", id, current, null),
    ]);
  }
}

/**
 * Only the standard that matches the basis may be set (the DB check `equipment_types_standard_matches_basis`
 * enforces this too; checking here gives a friendly message). Adds problems to `fields`; returns numeric strings.
 */
function checkStandard(input: { basis: Basis; lKmStandard?: number | null; lHrStandard?: number | null }, fields: Record<string, string>) {
  const hasKm = input.lKmStandard !== null && input.lKmStandard !== undefined;
  const hasHr = input.lHrStandard !== null && input.lHrStandard !== undefined;

  if (input.basis === "km") {
    if (!isPositive(input.lKmStandard)) fields.lKmStandard = "Enter an L/km standard above 0";
    if (hasHr) fields.lHrStandard = "Odometer types use an L/km standard, not L/hr";
  } else if (input.basis === "hours") {
    if (!isPositive(input.lHrStandard)) fields.lHrStandard = "Enter an L/hr standard above 0";
    if (hasKm) fields.lKmStandard = "Hour-meter types use an L/hr standard, not L/km";
  } else {
    fields.basis = "Pick how usage is measured";
  }

  return {
    lKmStandard: input.basis === "km" && isPositive(input.lKmStandard) ? toNumeric(input.lKmStandard, 3) : null,
    lHrStandard: input.basis === "hours" && isPositive(input.lHrStandard) ? toNumeric(input.lHrStandard, 2) : null,
  };
}
