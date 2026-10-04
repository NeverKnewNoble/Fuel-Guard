/**
 * Seeds the minimum data needed to use the portal: sites, the two demo
 * accounts shown on the login page, the default alert thresholds, and the
 * standard equipment types.
 * Safe to re-run — existing rows are left untouched.
 *
 *   SEED_PASSWORD='choose-a-password' yarn db:seed
 */
import "dotenv/config";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { alertThresholds, equipmentTypes, sites, users } from "./schema";

const password = process.env.SEED_PASSWORD;
if (!password || password.length < 8) {
  console.error("Set SEED_PASSWORD (at least 8 characters) to the password for the demo accounts.");
  process.exit(1);
}

const db = drizzle(process.env.DATABASE_URL!);

async function main() {
  await db
    .insert(sites)
    .values([
      { code: "SITE-A", name: "Site A – Kumasi", region: "Ashanti" },
      { code: "SITE-B", name: "Site B – Accra", region: "Greater Accra" },
      { code: "SITE-C", name: "Site C – Tamale", region: "Northern" },
    ])
    .onConflictDoNothing();

  const [siteA] = await db.select({ id: sites.id }).from(sites).where(eq(sites.code, "SITE-A"));
  const passwordHash = await hash(password!, 12);

  const inserted = await db
    .insert(users)
    .values([
      {
        name: "Kwabena Adjei",
        email: "kwabena.adjei@example.com",
        role: "administrator",
        status: "active",
        passwordHash,
      },
      {
        name: "Kwame Asante",
        email: "kwame.asante@example.com",
        role: "records_taker",
        status: "active",
        siteId: siteA.id,
        passwordHash,
      },
    ])
    .onConflictDoNothing()
    .returning({ email: users.email });

  await db
    .insert(alertThresholds)
    .values([
      { level: "watch", percent: "5" },
      { level: "high", percent: "15" },
      { level: "critical", percent: "25" },
    ])
    .onConflictDoNothing();

  // Only the standard matching the basis may be set (equipment_types_standard_matches_basis).
  await db
    .insert(equipmentTypes)
    .values([
      { name: "Excavator", basis: "hours", lHrStandard: "12.50" },
      { name: "Bulldozer", basis: "hours", lHrStandard: "18.00" },
      { name: "Dump Truck", basis: "km", lKmStandard: "0.380" },
      { name: "Grader", basis: "hours", lHrStandard: "15.20" },
      { name: "Pickup Truck", basis: "km", lKmStandard: "0.120" },
      { name: "Wheel Loader", basis: "hours", lHrStandard: "14.00" },
      { name: "Compactor", basis: "hours", lHrStandard: "10.50" },
      { name: "Crane", basis: "hours", lHrStandard: "22.00" },
    ])
    .onConflictDoNothing();

  console.log(
    inserted.length
      ? `Created accounts: ${inserted.map((u) => u.email).join(", ")}`
      : "Demo accounts already exist — passwords were not changed."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
