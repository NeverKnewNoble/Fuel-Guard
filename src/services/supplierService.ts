import { sql } from "drizzle-orm";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import type { SupplierOption } from "@/types/supplier";
import { ValidationError } from "./errors";

export class SupplierService {
  /** For a `<datalist>`, so the free-text Supplier field suggests existing names. */
  static async list(): Promise<SupplierOption[]> {
    return db.query.suppliers.findMany({ columns: { id: true, name: true }, orderBy: { name: "asc" } });
  }

  /** Matches an existing supplier case-insensitively, so "GOIL" and "Goil" don't become two suppliers. */
  static async findOrCreate(name: string): Promise<SupplierOption> {
    const trimmed = name.trim();
    if (!trimmed) throw new ValidationError("Enter a supplier.", { supplier: "Required" });

    const existing = await findByName(trimmed);
    if (existing) return existing;

    const [created] = await db
      .insert(suppliers)
      .values({ name: trimmed })
      .onConflictDoNothing()
      .returning({ id: suppliers.id, name: suppliers.name });
    if (created) return created;

    // Another request created it between the lookup and the insert.
    return (await findByName(trimmed))!;
  }
}

function findByName(name: string) {
  return db.query.suppliers.findFirst({
    columns: { id: true, name: true },
    where: { RAW: (t) => sql`lower(${t.name}) = lower(${name})` },
  });
}
