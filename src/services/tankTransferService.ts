import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { tankTransfers, vTankLevels } from "@/db/schema";
import type { CreateTransferInput, TransferRow } from "@/types/tank";
import type { Actor } from "@/types/user";
import { AUDIT_ACTIONS, AuditLogService } from "./auditLogService";
import { NotFoundError, throwIfInvalid } from "./errors";
import { ReportingPeriodService } from "./reportingPeriodService";
import { SessionService } from "./sessionService";
import { formatLitres, isInFuture, isPositive, isValidDate, toNumeric } from "./utils";

const WITH = {
  fromTank: { columns: { name: true } },
  toTank: { columns: { name: true } },
  transferrer: { columns: { name: true } },
  voider: { columns: { name: true } },
} as const;

type TransferWithRelations = typeof tankTransfers.$inferSelect & {
  fromTank: { name: string };
  toTank: { name: string };
  transferrer: { name: string };
  voider: { name: string } | null;
};

export class TankTransferService {
  /** Transfer log, newest first. */
  static async list(filters: { limit?: number } = {}): Promise<TransferRow[]> {
    const rows = await db.query.tankTransfers.findMany({
      with: WITH,
      orderBy: { transferredAt: "desc" },
      limit: filters.limit ?? 50,
    });
    return rows.map(toTransferRow);
  }

  static async getById(id: string): Promise<TransferRow> {
    const row = await db.query.tankTransfers.findFirst({ where: { id }, with: WITH });
    if (!row) throw new NotFoundError("Transfer");
    return toTransferRow(row);
  }

  /** Moves fuel between two tanks. The source must hold the litres and the destination must have room for them. */
  static async create(input: CreateTransferInput, actor: Actor): Promise<{ id: string; code: string }> {
    SessionService.assertAdmin(actor);

    const note = input.note?.trim() || null;
    const fields: Record<string, string> = {};
    if (!input.fromTankId) fields.fromTankId = "Pick the tank to take fuel from";
    if (!input.toTankId) fields.toTankId = "Pick the tank to put fuel into";
    else if (input.toTankId === input.fromTankId) fields.toTankId = "Pick a different tank";
    if (!isPositive(input.litres)) fields.litres = "Quantity must be above 0";
    if (!isValidDate(input.transferredAt)) fields.transferredAt = "Enter a valid date and time";
    else if (isInFuture(input.transferredAt)) fields.transferredAt = "Can't be in the future";
    throwIfInvalid(fields);

    await ReportingPeriodService.assertOpen(input.transferredAt);

    // v_tank_levels only includes non-archived tanks.
    const levels = await db
      .select({ id: vTankLevels.tankId, name: vTankLevels.name, capacityL: vTankLevels.capacityL, currentL: vTankLevels.currentL })
      .from(vTankLevels)
      .where(inArray(vTankLevels.tankId, [input.fromTankId, input.toTankId]));
    const from = levels.find((t) => t.id === input.fromTankId);
    const to = levels.find((t) => t.id === input.toTankId);
    throwIfInvalid({
      ...(from ? {} : { fromTankId: "Pick the tank to take fuel from" }),
      ...(to ? {} : { toTankId: "Pick the tank to put fuel into" }),
    });

    const available = Number(from!.currentL);
    const free = Number(to!.capacityL) - Number(to!.currentL);
    if (input.litres > available) {
      throwIfInvalid({ litres: `${from!.name} only holds ${formatLitres(Math.max(available, 0))} L.` });
    }
    if (input.litres > free) {
      throwIfInvalid({ litres: `That would overfill ${to!.name} (${formatLitres(Math.max(free, 0))} L of space left).` });
    }

    const id = crypto.randomUUID();
    const values = {
      fromTankId: input.fromTankId,
      toTankId: input.toTankId,
      litres: toNumeric(input.litres),
      transferredBy: actor.id,
      transferredAt: input.transferredAt,
      note,
    };
    const [[created]] = (await db.batch([
      db.insert(tankTransfers).values({ id, ...values }).returning({ id: tankTransfers.id, code: tankTransfers.code }),
      AuditLogService.entry(actor.id, AUDIT_ACTIONS.transferCreate, "tank_transfers", id, null, values),
    ])) as [{ id: string; code: string }[], ...unknown[]];
    return created;
  }

  /** Voids a transfer recorded in error, or restores one. It stays in the log either way. */
  static async setVoided(id: string, input: { voided: boolean; reason?: string }, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);
    const current = await TankTransferService.getById(id);
    if (Boolean(current.voidedAt) === input.voided) return;

    await ReportingPeriodService.assertOpen(current.transferredAt);

    const reason = input.reason?.trim() ?? "";
    if (input.voided) throwIfInvalid(reason ? {} : { reason: "Say why it's being voided" });

    const after = input.voided
      ? { voidedAt: new Date(), voidedBy: actor.id, voidReason: reason }
      : { voidedAt: null, voidedBy: null, voidReason: null };

    await db.batch([
      db.update(tankTransfers).set(after).where(eq(tankTransfers.id, id)),
      AuditLogService.entry(
        actor.id,
        input.voided ? AUDIT_ACTIONS.transferVoid : AUDIT_ACTIONS.transferRestore,
        "tank_transfers",
        id,
        { code: current.code, litres: current.litres, voidedAt: current.voidedAt },
        { ...after, litres: current.litres }
      ),
    ]);
  }
}

function toTransferRow(r: TransferWithRelations): TransferRow {
  return {
    id: r.id,
    code: r.code,
    fromTankId: r.fromTankId,
    fromTankName: r.fromTank.name,
    toTankId: r.toTankId,
    toTankName: r.toTank.name,
    litres: Number(r.litres),
    note: r.note,
    transferredBy: r.transferrer.name,
    transferredAt: r.transferredAt,
    voidedAt: r.voidedAt,
    voidedBy: r.voider?.name ?? null,
    voidReason: r.voidReason,
  };
}
