/**
 * FuelGuard database schema — implements docs/database-schema.md.
 * Relations for the query API live in ./relations.ts.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  pgView,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* --------------------------------- Helpers -------------------------------- */

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

const tstz = (name: string) => timestamp(name, { withTimezone: true });

const litres = (name: string) => numeric(name, { precision: 10, scale: 2 });

/**
 * Human-readable code default, e.g. `EQ-001`, drawn from a sequence. Pads to
 * `width` digits but never truncates once the counter outgrows it (EQ-1000).
 */
const codeDefault = (sequence: string, prefix: string, width: number) =>
  sql.raw(
    `('${prefix}-' || regexp_replace(lpad(nextval('${sequence}')::text, 12, '0'), '^0{0,${12 - width}}', ''))`
  );

/* ---------------------------------- Enums --------------------------------- */

export const userRole = pgEnum("user_role", ["administrator", "records_taker"]);
export const accountStatus = pgEnum("account_status", ["active", "invited", "disabled"]);
export const measurementBasis = pgEnum("measurement_basis", ["hours", "km"]);
export const equipmentStatus = pgEnum("equipment_status", ["active", "maintenance", "idle", "retired"]);
export const tankKind = pgEnum("tank_kind", ["bulk", "mobile_bowser", "day_tank"]);
export const periodStatus = pgEnum("period_status", ["open", "closed"]);
export const entryStatus = pgEnum("entry_status", ["locked", "watch", "flagged"]);
export const correctionStatus = pgEnum("correction_status", ["pending", "approved", "rejected"]);
export const alertSeverity = pgEnum("alert_severity", ["watch", "high", "critical"]);
export const alertState = pgEnum("alert_state", ["open", "reviewing", "resolved"]);
export const alertRule = pgEnum("alert_rule", [
  "over_standard",
  "exceeds_tank_capacity",
  "repeat_top_up",
  "no_meter_movement",
]);

/* -------------------------------- Sequences ------------------------------- */

export const usersCodeSeq = pgSequence("users_code_seq");
export const equipmentCodeSeq = pgSequence("equipment_code_seq");
export const tanksCodeSeq = pgSequence("tanks_code_seq");
export const tankIntakesCodeSeq = pgSequence("tank_intakes_code_seq");
export const fuelEntriesCodeSeq = pgSequence("fuel_entries_code_seq");
export const theftAlertsCodeSeq = pgSequence("theft_alerts_code_seq");

/* --------------------------- 4.1 People and places ------------------------ */

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  region: text("region"),
  archivedAt: tstz("archived_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique().default(codeDefault("users_code_seq", "USR", 2)),
    name: text("name").notNull(),
    /** Unique case-insensitively via users_email_lower_key. */
    email: text("email").notNull(),
    /** Null while invited; drop if an auth library owns credentials. */
    passwordHash: text("password_hash"),
    role: userRole("role").notNull().default("records_taker"),
    status: accountStatus("status").notNull().default("invited"),
    /** Null means "All sites". */
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "restrict" }),
    invitedBy: uuid("invited_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    lastActiveAt: tstz("last_active_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_lower_key").on(sql`lower(${t.email})`),
    index("users_site_id_idx").on(t.siteId),
    check("users_records_taker_has_site", sql`${t.role} <> 'records_taker' OR ${t.siteId} IS NOT NULL`),
  ]
);

export const operators = pgTable("operators", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "restrict" }),
  userId: uuid("user_id").unique().references(() => users.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ------------------------- 4.2 Equipment and standards -------------------- */

export const equipmentTypes = pgTable(
  "equipment_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    basis: measurementBasis("basis").notNull(),
    lKmStandard: numeric("l_km_standard", { precision: 8, scale: 3 }),
    lHrStandard: numeric("l_hr_standard", { precision: 8, scale: 2 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "equipment_types_standard_matches_basis",
      sql`(${t.basis} = 'km' AND ${t.lKmStandard} IS NOT NULL AND ${t.lHrStandard} IS NULL)
        OR (${t.basis} = 'hours' AND ${t.lHrStandard} IS NOT NULL AND ${t.lKmStandard} IS NULL)`
    ),
    check(
      "equipment_types_standard_positive",
      sql`COALESCE(${t.lKmStandard}, ${t.lHrStandard}) > 0`
    ),
  ]
);

export const equipment = pgTable(
  "equipment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique().default(codeDefault("equipment_code_seq", "EQ", 3)),
    equipmentTypeId: uuid("equipment_type_id")
      .notNull()
      .references(() => equipmentTypes.id, { onDelete: "restrict" }),
    makeModel: text("make_model").notNull(),
    registrationNo: text("registration_no").unique(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "restrict" }),
    status: equipmentStatus("status").notNull().default("active"),
    fuelTankCapacityL: litres("fuel_tank_capacity_l"),
    lKmStandardOverride: numeric("l_km_standard_override", { precision: 8, scale: 3 }),
    lHrStandardOverride: numeric("l_hr_standard_override", { precision: 8, scale: 2 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("equipment_site_id_idx").on(t.siteId),
    index("equipment_equipment_type_id_idx").on(t.equipmentTypeId),
    check("equipment_fuel_tank_capacity_positive", sql`${t.fuelTankCapacityL} IS NULL OR ${t.fuelTankCapacityL} > 0`),
    check(
      "equipment_overrides_positive",
      sql`(${t.lKmStandardOverride} IS NULL OR ${t.lKmStandardOverride} > 0)
        AND (${t.lHrStandardOverride} IS NULL OR ${t.lHrStandardOverride} > 0)`
    ),
  ]
);

/** Exactly three rows (watch / high / critical); ordering is enforced in the update action. */
export const alertThresholds = pgTable(
  "alert_thresholds",
  {
    level: alertSeverity("level").primaryKey(),
    percent: numeric("percent", { precision: 6, scale: 2 }).notNull(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: updatedAt(),
  },
  (t) => [check("alert_thresholds_percent_positive", sql`${t.percent} > 0`)]
);

/* ------------------------------ 4.3 Fuel stock ---------------------------- */

export const tanks = pgTable(
  "tanks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique().default(codeDefault("tanks_code_seq", "TNK", 2)),
    name: text("name").notNull(),
    kind: tankKind("kind").notNull(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "restrict" }),
    capacityL: litres("capacity_l").notNull(),
    archivedAt: tstz("archived_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tanks_site_id_idx").on(t.siteId),
    check("tanks_capacity_positive", sql`${t.capacityL} > 0`),
  ]
);

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  contact: text("contact"),
  createdAt: createdAt(),
});

export const tankIntakes = pgTable(
  "tank_intakes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique().default(codeDefault("tank_intakes_code_seq", "INT", 3)),
    tankId: uuid("tank_id")
      .notNull()
      .references(() => tanks.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    deliveryNote: text("delivery_note").notNull(),
    litres: litres("litres").notNull(),
    costPerLitre: numeric("cost_per_litre", { precision: 8, scale: 3 }).notNull(),
    totalCost: numeric("total_cost", { precision: 12, scale: 2 }).generatedAlwaysAs(
      sql`round(litres * cost_per_litre, 2)`
    ),
    receivedBy: uuid("received_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    receivedAt: tstz("received_at").notNull(),
    /** Recorded in error: kept for history, but ignored by stock levels, costs and the reconciliation. */
    voidedAt: tstz("voided_at"),
    voidedBy: uuid("voided_by").references(() => users.id, { onDelete: "restrict" }),
    voidReason: text("void_reason"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("tank_intakes_supplier_delivery_note_key").on(t.supplierId, t.deliveryNote),
    index("tank_intakes_tank_received_idx").on(t.tankId, t.receivedAt.desc()),
    check("tank_intakes_litres_positive", sql`${t.litres} > 0`),
    check("tank_intakes_cost_non_negative", sql`${t.costPerLitre} >= 0`),
    check(
      "tank_intakes_void_consistent",
      sql`(${t.voidedAt} IS NULL) = (${t.voidedBy} IS NULL) AND (${t.voidedAt} IS NOT NULL OR ${t.voidReason} IS NULL)`
    ),
  ]
);

export const tankDips = pgTable(
  "tank_dips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tankId: uuid("tank_id")
      .notNull()
      .references(() => tanks.id, { onDelete: "restrict" }),
    measuredL: litres("measured_l").notNull(),
    measuredAt: tstz("measured_at").notNull(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("tank_dips_tank_measured_idx").on(t.tankId, t.measuredAt.desc()),
    check("tank_dips_measured_non_negative", sql`${t.measuredL} >= 0`),
  ]
);

export const reportingPeriods = pgTable(
  "reporting_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Always the 1st of the month. */
    month: date("month").notNull().unique(),
    status: periodStatus("status").notNull().default("open"),
    closedBy: uuid("closed_by").references(() => users.id, { onDelete: "restrict" }),
    closedAt: tstz("closed_at"),
  },
  (t) => [
    check("reporting_periods_first_of_month", sql`EXTRACT(DAY FROM ${t.month}) = 1`),
    check(
      "reporting_periods_closed_consistent",
      sql`(${t.status} = 'closed') = (${t.closedBy} IS NOT NULL AND ${t.closedAt} IS NOT NULL)`
    ),
  ]
);

export const tankPeriodBalances = pgTable(
  "tank_period_balances",
  {
    periodId: uuid("period_id")
      .notNull()
      .references(() => reportingPeriods.id, { onDelete: "restrict" }),
    tankId: uuid("tank_id")
      .notNull()
      .references(() => tanks.id, { onDelete: "restrict" }),
    openingL: litres("opening_l").notNull(),
    /** Null until the period closes. */
    closingMeasuredL: litres("closing_measured_l"),
  },
  (t) => [
    primaryKey({ columns: [t.periodId, t.tankId] }),
    check("tank_period_balances_non_negative", sql`${t.openingL} >= 0 AND (${t.closingMeasuredL} IS NULL OR ${t.closingMeasuredL} >= 0)`),
  ]
);

/* ------------------------ 4.4 Fuel issued to equipment ------------------- */

export const fuelEntries = pgTable(
  "fuel_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique().default(codeDefault("fuel_entries_code_seq", "LOG", 4)),
    dispensedAt: tstz("dispensed_at").notNull(),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "restrict" }),
    tankId: uuid("tank_id")
      .notNull()
      .references(() => tanks.id, { onDelete: "restrict" }),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "restrict" }),
    /** Where it happened — a snapshot, since equipment can move sites. */
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "restrict" }),
    locationActivity: text("location_activity").notNull(),
    litres: litres("litres").notNull(),
    odometerStart: numeric("odometer_start", { precision: 12, scale: 1 }),
    odometerEnd: numeric("odometer_end", { precision: 12, scale: 1 }),
    hourMeterStart: numeric("hour_meter_start", { precision: 10, scale: 1 }),
    hourMeterEnd: numeric("hour_meter_end", { precision: 10, scale: 1 }),
    // Generated columns can't reference each other in Postgres, so each repeats its inputs.
    totalKm: numeric("total_km", { precision: 12, scale: 1 }).generatedAlwaysAs(
      sql`odometer_end - odometer_start`
    ),
    totalHours: numeric("total_hours", { precision: 10, scale: 1 }).generatedAlwaysAs(
      sql`hour_meter_end - hour_meter_start`
    ),
    lPerKm: numeric("l_per_km", { precision: 12, scale: 3 }).generatedAlwaysAs(
      sql`round(litres / NULLIF(odometer_end - odometer_start, 0), 3)`
    ),
    lPerHr: numeric("l_per_hr", { precision: 12, scale: 2 }).generatedAlwaysAs(
      sql`round(litres / NULLIF(hour_meter_end - hour_meter_start, 0), 2)`
    ),
    /** Price snapshot from the tank's latest intake. */
    unitCostGhs: numeric("unit_cost_ghs", { precision: 8, scale: 3 }).notNull(),
    status: entryStatus("status").notNull().default("locked"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** Recorded in error: kept for history, but ignored by stock, costs, summaries and the dashboard. */
    voidedAt: tstz("voided_at"),
    voidedBy: uuid("voided_by").references(() => users.id, { onDelete: "restrict" }),
    voidReason: text("void_reason"),
    createdAt: createdAt(),
  },
  (t) => [
    index("fuel_entries_equipment_dispensed_idx").on(t.equipmentId, t.dispensedAt.desc()),
    index("fuel_entries_tank_dispensed_idx").on(t.tankId, t.dispensedAt),
    index("fuel_entries_recorded_by_dispensed_idx").on(t.recordedBy, t.dispensedAt.desc()),
    index("fuel_entries_site_dispensed_idx").on(t.siteId, t.dispensedAt),
    index("fuel_entries_needs_review_idx").on(t.status).where(sql`${t.status} <> 'locked'`),
    check("fuel_entries_litres_positive", sql`${t.litres} > 0`),
    check("fuel_entries_unit_cost_non_negative", sql`${t.unitCostGhs} >= 0`),
    check(
      "fuel_entries_odometer_order",
      sql`${t.odometerStart} IS NULL OR ${t.odometerEnd} IS NULL OR ${t.odometerEnd} >= ${t.odometerStart}`
    ),
    check(
      "fuel_entries_hour_meter_order",
      sql`${t.hourMeterStart} IS NULL OR ${t.hourMeterEnd} IS NULL OR ${t.hourMeterEnd} >= ${t.hourMeterStart}`
    ),
    check(
      "fuel_entries_has_meter_reading",
      sql`(${t.odometerStart} IS NOT NULL AND ${t.odometerEnd} IS NOT NULL)
        OR (${t.hourMeterStart} IS NOT NULL AND ${t.hourMeterEnd} IS NOT NULL)`
    ),
    check(
      "fuel_entries_void_consistent",
      sql`(${t.voidedAt} IS NULL) = (${t.voidedBy} IS NULL) AND (${t.voidedAt} IS NOT NULL OR ${t.voidReason} IS NULL)`
    ),
  ]
);

export const fuelEntryCorrections = pgTable(
  "fuel_entry_corrections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fuelEntryId: uuid("fuel_entry_id")
      .notNull()
      .references(() => fuelEntries.id, { onDelete: "restrict" }),
    /** e.g. { "litres": { "from": 210, "to": 201 } } */
    changes: jsonb("changes").$type<Record<string, { from: unknown; to: unknown }>>().notNull(),
    reason: text("reason").notNull(),
    status: correctionStatus("status").notNull().default("pending"),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "restrict" }),
    reviewedAt: tstz("reviewed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("fuel_entry_corrections_entry_idx").on(t.fuelEntryId),
    index("fuel_entry_corrections_pending_idx").on(t.createdAt).where(sql`${t.status} = 'pending'`),
    check(
      "fuel_entry_corrections_review_consistent",
      sql`(${t.status} = 'pending') = (${t.reviewedBy} IS NULL AND ${t.reviewedAt} IS NULL)`
    ),
  ]
);

/* ------------------------- 4.5 Theft and anomaly alerts ------------------- */

export const theftAlerts = pgTable(
  "theft_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique().default(codeDefault("theft_alerts_code_seq", "ALR", 3)),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "restrict" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "restrict" }),
    rule: alertRule("rule").notNull(),
    severity: alertSeverity("severity").notNull(),
    state: alertState("state").notNull().default("open"),
    variancePct: numeric("variance_pct", { precision: 6, scale: 2 }),
    summary: text("summary").notNull(),
    detectedAt: tstz("detected_at").notNull().defaultNow(),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "restrict" }),
    resolvedAt: tstz("resolved_at"),
    resolutionNote: text("resolution_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("theft_alerts_state_detected_idx").on(t.state, t.detectedAt.desc()),
    index("theft_alerts_equipment_detected_idx").on(t.equipmentId, t.detectedAt.desc()),
    check(
      "theft_alerts_resolved_consistent",
      sql`(${t.state} = 'resolved') = (${t.resolvedBy} IS NOT NULL AND ${t.resolvedAt} IS NOT NULL)`
    ),
  ]
);

export const alertFuelEntries = pgTable(
  "alert_fuel_entries",
  {
    alertId: uuid("alert_id")
      .notNull()
      .references(() => theftAlerts.id, { onDelete: "cascade" }),
    fuelEntryId: uuid("fuel_entry_id")
      .notNull()
      .references(() => fuelEntries.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.alertId, t.fuelEntryId] }),
    index("alert_fuel_entries_fuel_entry_idx").on(t.fuelEntryId),
  ]
);

export const alertReads = pgTable(
  "alert_reads",
  {
    alertId: uuid("alert_id")
      .notNull()
      .references(() => theftAlerts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: tstz("read_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.alertId, t.userId] }),
    index("alert_reads_user_idx").on(t.userId),
  ]
);

/* --------------------------------- 4.6 Audit ------------------------------ */

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    /** Null for system jobs. */
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entityType, t.entityId, t.createdAt.desc())]
);

/* ------------------------------ 5. Derived views -------------------------- */
// Views don't reference each other, so creation order never matters.

const TZ = "Africa/Accra";

export const vEquipmentStandards = pgView("v_equipment_standards", {
  equipmentId: uuid("equipment_id").notNull(),
  equipmentCode: text("equipment_code").notNull(),
  equipmentTypeId: uuid("equipment_type_id").notNull(),
  typeName: text("type_name").notNull(),
  basis: measurementBasis("basis").notNull(),
  makeModel: text("make_model").notNull(),
  siteId: uuid("site_id").notNull(),
  status: equipmentStatus("status").notNull(),
  lKmStandard: numeric("l_km_standard", { precision: 8, scale: 3 }),
  lHrStandard: numeric("l_hr_standard", { precision: 8, scale: 2 }),
}).as(sql`
  SELECT
    e.id AS equipment_id,
    e.code AS equipment_code,
    t.id AS equipment_type_id,
    t.name AS type_name,
    t.basis,
    e.make_model,
    e.site_id,
    e.status,
    COALESCE(e.l_km_standard_override, t.l_km_standard) AS l_km_standard,
    COALESCE(e.l_hr_standard_override, t.l_hr_standard) AS l_hr_standard
  FROM equipment e
  JOIN equipment_types t ON t.id = e.equipment_type_id
`);

/**
 * A tank's running level: the last dip, plus deliveries and minus issues recorded since it.
 * `measured_l` keeps the raw dip, so the reconciliation can still compare paper against reality.
 */
export const vTankLevels = pgView("v_tank_levels", {
  tankId: uuid("tank_id").notNull(),
  tankCode: text("tank_code").notNull(),
  name: text("name").notNull(),
  siteId: uuid("site_id").notNull(),
  capacityL: litres("capacity_l").notNull(),
  /** Last dip + intake − issued since that dip. 0 for a tank that has never been dipped or used. */
  currentL: litres("current_l").notNull(),
  /** The last dip itself, or null when the tank has never been dipped. */
  measuredL: litres("measured_l"),
  measuredAt: tstz("measured_at"),
  /** Net litres in (+) or out (−) since the last dip; 0 means the level is as measured. */
  sinceDipL: litres("since_dip_l").notNull(),
  fillPct: numeric("fill_pct", { precision: 5, scale: 1 }),
  lastRefillAt: tstz("last_refill_at"),
}).as(sql`
  SELECT
    tk.id AS tank_id,
    tk.code AS tank_code,
    tk.name,
    tk.site_id,
    tk.capacity_l,
    COALESCE(d.measured_l, 0) + COALESCE(m.intake_l, 0) - COALESCE(m.issued_l, 0) AS current_l,
    d.measured_l,
    d.measured_at,
    COALESCE(m.intake_l, 0) - COALESCE(m.issued_l, 0) AS since_dip_l,
    round(
      (COALESCE(d.measured_l, 0) + COALESCE(m.intake_l, 0) - COALESCE(m.issued_l, 0)) / tk.capacity_l * 100,
      1
    ) AS fill_pct,
    i.last_refill_at
  FROM tanks tk
  LEFT JOIN LATERAL (
    SELECT measured_l, measured_at FROM tank_dips
    WHERE tank_id = tk.id ORDER BY measured_at DESC LIMIT 1
  ) d ON true
  LEFT JOIN LATERAL (
    SELECT
      (SELECT sum(litres) FROM tank_intakes
        WHERE tank_id = tk.id AND voided_at IS NULL
          AND (d.measured_at IS NULL OR received_at > d.measured_at)) AS intake_l,
      (SELECT sum(litres) FROM fuel_entries
        WHERE tank_id = tk.id AND voided_at IS NULL
          AND (d.measured_at IS NULL OR dispensed_at > d.measured_at)) AS issued_l
  ) m ON true
  LEFT JOIN LATERAL (
    SELECT max(received_at) AS last_refill_at FROM tank_intakes WHERE tank_id = tk.id
  ) i ON true
  WHERE tk.archived_at IS NULL
`);

export const vTankReconciliation = pgView("v_tank_reconciliation", {
  periodId: uuid("period_id").notNull(),
  month: date("month").notNull(),
  tankId: uuid("tank_id").notNull(),
  tankCode: text("tank_code").notNull(),
  name: text("name").notNull(),
  openingL: litres("opening_l").notNull(),
  intakeL: litres("intake_l").notNull(),
  issuedL: litres("issued_l").notNull(),
  expectedL: litres("expected_l").notNull(),
  measuredL: litres("measured_l"),
  /** measured − expected; negative = unexplained loss. */
  varianceL: litres("variance_l"),
}).as(sql.raw(`
  SELECT
    p.id AS period_id,
    p.month,
    tk.id AS tank_id,
    tk.code AS tank_code,
    tk.name,
    COALESCE(b.opening_l, 0) AS opening_l,
    COALESCE(i.intake_l, 0) AS intake_l,
    COALESCE(f.issued_l, 0) AS issued_l,
    COALESCE(b.opening_l, 0) + COALESCE(i.intake_l, 0) - COALESCE(f.issued_l, 0) AS expected_l,
    COALESCE(b.closing_measured_l, d.measured_l) AS measured_l,
    COALESCE(b.closing_measured_l, d.measured_l)
      - (COALESCE(b.opening_l, 0) + COALESCE(i.intake_l, 0) - COALESCE(f.issued_l, 0)) AS variance_l
  FROM (
    SELECT
      id,
      month,
      month::timestamp AT TIME ZONE '${TZ}' AS starts_at,
      (month + interval '1 month') AT TIME ZONE '${TZ}' AS ends_at
    FROM reporting_periods
  ) p
  CROSS JOIN tanks tk
  LEFT JOIN tank_period_balances b ON b.period_id = p.id AND b.tank_id = tk.id
  LEFT JOIN LATERAL (
    SELECT sum(litres) AS intake_l FROM tank_intakes
    WHERE tank_id = tk.id AND voided_at IS NULL AND received_at >= p.starts_at AND received_at < p.ends_at
  ) i ON true
  LEFT JOIN LATERAL (
    SELECT sum(litres) AS issued_l FROM fuel_entries
    WHERE tank_id = tk.id AND voided_at IS NULL AND dispensed_at >= p.starts_at AND dispensed_at < p.ends_at
  ) f ON true
  LEFT JOIN LATERAL (
    SELECT measured_l FROM tank_dips
    WHERE tank_id = tk.id AND measured_at < p.ends_at
    ORDER BY measured_at DESC LIMIT 1
  ) d ON true
  WHERE tk.archived_at IS NULL
`));

export const vMonthlyEquipmentSummary = pgView("v_monthly_equipment_summary", {
  periodId: uuid("period_id").notNull(),
  month: date("month").notNull(),
  equipmentId: uuid("equipment_id").notNull(),
  equipmentCode: text("equipment_code").notNull(),
  typeName: text("type_name").notNull(),
  basis: measurementBasis("basis").notNull(),
  siteId: uuid("site_id").notNull(),
  litres: litres("litres").notNull(),
  totalKm: numeric("total_km"),
  totalHours: numeric("total_hours"),
  avgLPerKm: numeric("avg_l_per_km"),
  avgLPerHr: numeric("avg_l_per_hr"),
  lKmStandard: numeric("l_km_standard", { precision: 8, scale: 3 }),
  lHrStandard: numeric("l_hr_standard", { precision: 8, scale: 2 }),
  variancePct: numeric("variance_pct"),
  costGhs: numeric("cost_ghs").notNull(),
  /** normal | watch | high | critical */
  status: text("status").notNull(),
}).as(sql.raw(`
  WITH base AS (
    SELECT
      p.id AS period_id,
      p.month,
      e.id AS equipment_id,
      e.code AS equipment_code,
      t.name AS type_name,
      t.basis,
      e.site_id,
      COALESCE(m.litres, 0) AS litres,
      m.total_km,
      m.total_hours,
      round(m.litres / NULLIF(m.total_km, 0), 3) AS avg_l_per_km,
      round(m.litres / NULLIF(m.total_hours, 0), 2) AS avg_l_per_hr,
      COALESCE(e.l_km_standard_override, t.l_km_standard) AS l_km_standard,
      COALESCE(e.l_hr_standard_override, t.l_hr_standard) AS l_hr_standard,
      COALESCE(m.cost_ghs, 0) AS cost_ghs
    FROM reporting_periods p
    CROSS JOIN equipment e
    JOIN equipment_types t ON t.id = e.equipment_type_id
    LEFT JOIN LATERAL (
      SELECT
        sum(f.litres) AS litres,
        sum(f.total_km) AS total_km,
        sum(f.total_hours) AS total_hours,
        round(sum(f.litres * f.unit_cost_ghs), 2) AS cost_ghs
      FROM fuel_entries f
      WHERE f.equipment_id = e.id
        AND f.voided_at IS NULL
        AND f.dispensed_at >= p.month::timestamp AT TIME ZONE '${TZ}'
        AND f.dispensed_at < (p.month + interval '1 month') AT TIME ZONE '${TZ}'
    ) m ON true
    WHERE e.status <> 'retired'
  ),
  scored AS (
    SELECT
      base.*,
      round(
        CASE base.basis
          WHEN 'km' THEN (avg_l_per_km - l_km_standard) / NULLIF(l_km_standard, 0) * 100
          ELSE (avg_l_per_hr - l_hr_standard) / NULLIF(l_hr_standard, 0) * 100
        END, 2
      ) AS variance_pct
    FROM base
  )
  SELECT
    scored.*,
    CASE
      WHEN variance_pct IS NULL THEN 'normal'
      WHEN variance_pct >= (SELECT percent FROM alert_thresholds WHERE level = 'critical') THEN 'critical'
      WHEN variance_pct >= (SELECT percent FROM alert_thresholds WHERE level = 'high') THEN 'high'
      WHEN variance_pct >= (SELECT percent FROM alert_thresholds WHERE level = 'watch') THEN 'watch'
      ELSE 'normal'
    END AS status
  FROM scored
`));

export const vDailyIssuance = pgView("v_daily_issuance", {
  day: date("day").notNull(),
  siteId: uuid("site_id").notNull(),
  litres: litres("litres").notNull(),
  entries: bigint("entries", { mode: "number" }).notNull(),
}).as(sql.raw(`
  SELECT
    (dispensed_at AT TIME ZONE '${TZ}')::date AS day,
    site_id,
    sum(litres) AS litres,
    count(*) AS entries
  FROM fuel_entries
  WHERE voided_at IS NULL
  GROUP BY 1, 2
`));
