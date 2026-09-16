import { db } from "@/db";
import { tankDips } from "@/db/schema";
import type { RecordDipInput, TankDipRow } from "@/types/tank";
import type { Actor } from "@/types/user";
import { NotFoundError, throwIfInvalid } from "./errors";
import { SessionService } from "./sessionService";
import { formatLitres, isInFuture, isNonNegative, isValidDate, toNumeric } from "./utils";

/** Dips are physical tank measurements. They drive the tank cards' level and the "measured" reconciliation column. */
export class TankDipService {
  static async record(input: RecordDipInput, actor: Actor): Promise<void> {
    SessionService.assertAdmin(actor);

    const tank = await db.query.tanks.findFirst({ columns: { id: true, capacityL: true, archivedAt: true }, where: { id: input.tankId } });
    if (!tank || tank.archivedAt) throw new NotFoundError("Tanker");
    const capacityL = Number(tank.capacityL);

    const fields: Record<string, string> = {};
    if (!isNonNegative(input.measuredL)) fields.measuredL = "Enter the measured litres";
    else if (input.measuredL > capacityL) fields.measuredL = `Can't be more than the tanker's ${formatLitres(capacityL)} L capacity`;
    if (!isValidDate(input.measuredAt)) fields.measuredAt = "Enter a valid date and time";
    else if (isInFuture(input.measuredAt)) fields.measuredAt = "Can't be in the future";
    throwIfInvalid(fields);

    await db.insert(tankDips).values({
      tankId: input.tankId,
      measuredL: toNumeric(input.measuredL),
      measuredAt: input.measuredAt,
      recordedBy: actor.id,
      note: input.note?.trim() || null,
    });
  }

  /** Newest first, for a tank history drawer. */
  static async listForTank(tankId: string, limit = 30): Promise<TankDipRow[]> {
    const rows = await db.query.tankDips.findMany({
      where: { tankId },
      with: { recorder: { columns: { id: true, name: true } } },
      orderBy: { measuredAt: "desc" },
      limit,
    });
    return rows.map((r) => ({
      id: r.id,
      measuredL: Number(r.measuredL),
      measuredAt: r.measuredAt,
      note: r.note,
      recordedBy: r.recorder,
    }));
  }

  static async latest(tankId: string): Promise<{ measuredL: number; measuredAt: Date } | null> {
    const row = await db.query.tankDips.findFirst({
      columns: { measuredL: true, measuredAt: true },
      where: { tankId },
      orderBy: { measuredAt: "desc" },
    });
    return row ? { measuredL: Number(row.measuredL), measuredAt: row.measuredAt } : null;
  }
}
