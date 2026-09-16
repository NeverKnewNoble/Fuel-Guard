import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tankIntakes, vTankLevels } from "@/db/schema";
import type { CreateIntakeInput, IntakeFilters, IntakeRow, UpdateIntakeInput } from "@/types/tank";
import type { Actor } from "@/types/user";
import { AUDIT_ACTIONS, AuditLogService } from "./auditLogService";
import { ConflictError, NotFoundError, isUniqueViolation, throwIfInvalid } from "./errors";
import { ReportingPeriodService } from "./reportingPeriodService";
import { SessionService } from "./sessionService";
import { SupplierService } from "./supplierService";
import { formatLitres, isInFuture, isNonNegative, isPositive, isValidDate, toNumeric } from "./utils";

const WITH = {
  tank: { columns: { name: true } },
  supplier: { columns: { name: true } },
  receiver: { columns: { name: true } },
  voider: { columns: { name: true } },
} as const;

type IntakeWithRelations = typeof tankIntakes.$inferSelect & {
  tank: { name: string };
  supplier: { name: string };
  receiver: { name: string };
  voider: { name: string } | null;
};

export class TankIntakeService {
  /** Intake log, newest first. */
  static async list(filters: IntakeFilters = {}): Promise<IntakeRow[]> {
    const receivedAt = filters.from || filters.to ? { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lt: filters.to } : {}) } : undefined;
    const rows = await db.query.tankIntakes.findMany({
      where: { tankId: filters.tankId, receivedAt },
      with: WITH,
      orderBy: { receivedAt: "desc" },
      limit: filters.limit ?? 50,
    });
    return rows.map(toIntakeRow);
  }

  static async getById(id: string): Promise<IntakeRow> {
    const row = await db.query.tankIntakes.findFirst({ where: { id }, with: WITH });
    if (!row) throw new NotFoundError("Delivery");
    return toIntakeRow(row);
  }

  static async create(input: CreateIntakeInput, actor: Actor): Promise<{ id: string; code: string; totalCost: number }> {
    SessionService.assertAdmin(actor);

    const deliveryNote = input.deliveryNote.trim();
    const fields: Record<string, string> = {};
    if (!input.tankId) fields.tankId = "Pick a tanker";
    if (!input.supplierName.trim()) fields.supplier = "Required";
    if (!deliveryNote) fields.deliveryNote = "Enter the delivery note number";
    if (!isPositive(input.litres)) fields.litres = "Quantity must be above 0";
    if (!isNonNegative(input.costPerLitre)) fields.costPerLitre = "Cost per litre can't be negative";
    if (!isValidDate(input.receivedAt)) fields.receivedAt = "Enter a valid date and time";
    else if (isInFuture(input.receivedAt)) fields.receivedAt = "Can't be in the future";
    if (!input.receivedById) fields.receivedById = "Pick who received the delivery";
    throwIfInvalid(fields);

    await ReportingPeriodService.assertOpen(input.receivedAt);

    const [[tank], receiver] = await Promise.all([
      // v_tank_levels only includes non-archived tanks.
      db
        .select({ name: vTankLevels.name, capacityL: vTankLevels.capacityL, currentL: vTankLevels.currentL })
        .from(vTankLevels)
        .where(eq(vTankLevels.tankId, input.tankId)),
      db.query.users.findFirst({ columns: { id: true, status: true }, where: { id: input.receivedById } }),
    ]);
    if (!tank) throwIfInvalid({ tankId: "Pick a tanker" });
    if (!receiver || receiver.status !== "active") throwIfInvalid({ receivedById: "Pick who received the delivery" });

    const capacityL = Number(tank.capacityL);
    const currentL = Number(tank.currentL);
    if (currentL + input.litres > capacityL) {
      throwIfInvalid({
        litres: `This delivery would overfill the tanker (capacity ${formatLitres(capacityL)} L, current ${formatLitres(currentL)} L).`,
      });
    }

    const supplier = await SupplierService.findOrCreate(input.supplierName);

    try {
      const [created] = await db
        .insert(tankIntakes)
        .values({
          tankId: input.tankId,
          supplierId: supplier.id,
          deliveryNote,
          litres: toNumeric(input.litres),
          costPerLitre: toNumeric(input.costPerLitre, 3),
          receivedBy: input.receivedById,
          receivedAt: input.receivedAt,
        })
        .returning({ id: tankIntakes.id, code: tankIntakes.code, totalCost: tankIntakes.totalCost });
      return { id: created.id, code: created.code, totalCost: Number(created.totalCost ?? 0) };
    } catch (error) {
      if (isUniqueViolation(error, "tank_intakes_supplier_delivery_note_key")) {
        throw new ConflictError(`Delivery note ${deliveryNote} is already recorded for this supplier.`);
      }
      throw error;
    }
  }

  /**
   * Corrects a delivery that was mistyped. The tanker can't change — void it and record another instead.
   * Re-checks the tanker's free space, ignoring this delivery's own litres.
   */
  static async update(id: string, input: UpdateIntakeInput, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const current = await TankIntakeService.getById(id);
    if (current.voidedAt) throw new ConflictError("This delivery is void. Restore it before editing.");

    const deliveryNote = input.deliveryNote.trim();
    const fields: Record<string, string> = {};
    if (!input.supplierName.trim()) fields.supplier = "Required";
    if (!deliveryNote) fields.deliveryNote = "Enter the delivery note number";
    if (!isPositive(input.litres)) fields.litres = "Quantity must be above 0";
    if (!isNonNegative(input.costPerLitre)) fields.costPerLitre = "Cost per litre can't be negative";
    if (!isValidDate(input.receivedAt)) fields.receivedAt = "Enter a valid date and time";
    else if (isInFuture(input.receivedAt)) fields.receivedAt = "Can't be in the future";
    if (!input.receivedById) fields.receivedById = "Pick who received the delivery";
    throwIfInvalid(fields);

    // Both months: the one it was in, and the one it's moving to.
    await Promise.all([
      ReportingPeriodService.assertOpen(current.receivedAt),
      ReportingPeriodService.assertOpen(input.receivedAt),
    ]);

    const [[tank], receiver] = await Promise.all([
      db
        .select({ name: vTankLevels.name, capacityL: vTankLevels.capacityL, currentL: vTankLevels.currentL })
        .from(vTankLevels)
        .where(eq(vTankLevels.tankId, current.tankId)),
      db.query.users.findFirst({ columns: { id: true, status: true }, where: { id: input.receivedById } }),
    ]);
    if (!tank) throw new NotFoundError("Tanker");
    if (!receiver || receiver.status !== "active") throwIfInvalid({ receivedById: "Pick who received the delivery" });

    const capacityL = Number(tank.capacityL);
    // The running level already counts the old quantity, so take it out before adding the new one.
    const withoutThis = Number(tank.currentL) - current.litres;
    if (withoutThis + input.litres > capacityL) {
      throwIfInvalid({
        litres: `That would overfill the tanker (capacity ${formatLitres(capacityL)} L, ${formatLitres(withoutThis)} L without this delivery).`,
      });
    }

    const supplier = await SupplierService.findOrCreate(input.supplierName);
    const after = {
      supplierId: supplier.id,
      deliveryNote,
      litres: toNumeric(input.litres),
      costPerLitre: toNumeric(input.costPerLitre, 3),
      receivedBy: input.receivedById,
      receivedAt: input.receivedAt,
    };

    try {
      await db.batch([
        db.update(tankIntakes).set(after).where(eq(tankIntakes.id, id)),
        AuditLogService.entry(actor.id, AUDIT_ACTIONS.intakeUpdate, "tank_intakes", id, current, after),
      ]);
    } catch (error) {
      if (isUniqueViolation(error, "tank_intakes_supplier_delivery_note_key")) {
        throw new ConflictError(`Delivery note ${deliveryNote} is already recorded for this supplier.`);
      }
      throw error;
    }
  }

  /**
   * Voids a delivery recorded in error, or restores one. A void delivery stays in the log but is
   * ignored by tank levels, the reconciliation and fuel costs, so nothing disappears from history.
   */
  static async setVoided(id: string, input: { voided: boolean; reason?: string }, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const current = await TankIntakeService.getById(id);
    if (Boolean(current.voidedAt) === input.voided) return;

    await ReportingPeriodService.assertOpen(current.receivedAt);

    const reason = input.reason?.trim() ?? "";
    if (input.voided) throwIfInvalid(reason ? {} : { reason: "Say why it's being voided" });

    const after = input.voided
      ? { voidedAt: new Date(), voidedBy: actor.id, voidReason: reason }
      : { voidedAt: null, voidedBy: null, voidReason: null };

    await db.batch([
      db.update(tankIntakes).set(after).where(eq(tankIntakes.id, id)),
      AuditLogService.entry(
        actor.id,
        input.voided ? AUDIT_ACTIONS.intakeVoid : AUDIT_ACTIONS.intakeRestore,
        "tank_intakes",
        id,
        { code: current.code, litres: current.litres, voidedAt: current.voidedAt },
        { ...after, litres: current.litres }
      ),
    ]);
  }

}

function toIntakeRow(r: IntakeWithRelations): IntakeRow {
  return {
    id: r.id,
    code: r.code,
    tankId: r.tankId,
    tankName: r.tank.name,
    supplierId: r.supplierId,
    supplier: r.supplier.name,
    deliveryNote: r.deliveryNote,
    litres: Number(r.litres),
    costPerLitre: Number(r.costPerLitre),
    totalCost: Number(r.totalCost ?? 0),
    receivedById: r.receivedBy,
    receivedBy: r.receiver.name,
    receivedAt: r.receivedAt,
    voidedAt: r.voidedAt,
    voidedBy: r.voider?.name ?? null,
    voidReason: r.voidReason,
  };
}
