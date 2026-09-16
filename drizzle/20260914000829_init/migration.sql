CREATE TYPE "account_status" AS ENUM('active', 'invited', 'disabled');--> statement-breakpoint
CREATE TYPE "alert_rule" AS ENUM('over_standard', 'exceeds_tank_capacity', 'repeat_top_up', 'no_meter_movement');--> statement-breakpoint
CREATE TYPE "alert_severity" AS ENUM('watch', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "alert_state" AS ENUM('open', 'reviewing', 'resolved');--> statement-breakpoint
CREATE TYPE "correction_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "entry_status" AS ENUM('locked', 'watch', 'flagged');--> statement-breakpoint
CREATE TYPE "equipment_status" AS ENUM('active', 'maintenance', 'idle', 'retired');--> statement-breakpoint
CREATE TYPE "measurement_basis" AS ENUM('hours', 'km');--> statement-breakpoint
CREATE TYPE "period_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "tank_kind" AS ENUM('bulk', 'mobile_bowser', 'day_tank');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('administrator', 'records_taker');--> statement-breakpoint
CREATE SEQUENCE "public"."equipment_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."fuel_entries_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."tank_intakes_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."tanks_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."theft_alerts_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."users_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "alert_fuel_entries" (
	"alert_id" uuid,
	"fuel_entry_id" uuid,
	CONSTRAINT "alert_fuel_entries_pkey" PRIMARY KEY("alert_id","fuel_entry_id")
);
--> statement-breakpoint
CREATE TABLE "alert_reads" (
	"alert_id" uuid,
	"user_id" uuid,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_reads_pkey" PRIMARY KEY("alert_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "alert_thresholds" (
	"level" "alert_severity" PRIMARY KEY,
	"percent" numeric(6,2) NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_thresholds_percent_positive" CHECK ("percent" > 0)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text DEFAULT ('EQ-' || regexp_replace(lpad(nextval('equipment_code_seq')::text, 12, '0'), '^0{0,9}', '')) NOT NULL UNIQUE,
	"equipment_type_id" uuid NOT NULL,
	"make_model" text NOT NULL,
	"registration_no" text UNIQUE,
	"site_id" uuid NOT NULL,
	"status" "equipment_status" DEFAULT 'active'::"equipment_status" NOT NULL,
	"fuel_tank_capacity_l" numeric(10,2),
	"l_km_standard_override" numeric(8,3),
	"l_hr_standard_override" numeric(8,2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_fuel_tank_capacity_positive" CHECK ("fuel_tank_capacity_l" IS NULL OR "fuel_tank_capacity_l" > 0),
	CONSTRAINT "equipment_overrides_positive" CHECK (("l_km_standard_override" IS NULL OR "l_km_standard_override" > 0)
        AND ("l_hr_standard_override" IS NULL OR "l_hr_standard_override" > 0))
);
--> statement-breakpoint
CREATE TABLE "equipment_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL UNIQUE,
	"basis" "measurement_basis" NOT NULL,
	"l_km_standard" numeric(8,3),
	"l_hr_standard" numeric(8,2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_types_standard_matches_basis" CHECK (("basis" = 'km' AND "l_km_standard" IS NOT NULL AND "l_hr_standard" IS NULL)
        OR ("basis" = 'hours' AND "l_hr_standard" IS NOT NULL AND "l_km_standard" IS NULL)),
	CONSTRAINT "equipment_types_standard_positive" CHECK (COALESCE("l_km_standard", "l_hr_standard") > 0)
);
--> statement-breakpoint
CREATE TABLE "fuel_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text DEFAULT ('LOG-' || regexp_replace(lpad(nextval('fuel_entries_code_seq')::text, 12, '0'), '^0{0,8}', '')) NOT NULL UNIQUE,
	"dispensed_at" timestamp with time zone NOT NULL,
	"equipment_id" uuid NOT NULL,
	"tank_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"location_activity" text NOT NULL,
	"litres" numeric(10,2) NOT NULL,
	"odometer_start" numeric(12,1),
	"odometer_end" numeric(12,1),
	"hour_meter_start" numeric(10,1),
	"hour_meter_end" numeric(10,1),
	"total_km" numeric(12,1) GENERATED ALWAYS AS (odometer_end - odometer_start) STORED,
	"total_hours" numeric(10,1) GENERATED ALWAYS AS (hour_meter_end - hour_meter_start) STORED,
	"l_per_km" numeric(12,3) GENERATED ALWAYS AS (round(litres / NULLIF(odometer_end - odometer_start, 0), 3)) STORED,
	"l_per_hr" numeric(12,2) GENERATED ALWAYS AS (round(litres / NULLIF(hour_meter_end - hour_meter_start, 0), 2)) STORED,
	"unit_cost_ghs" numeric(8,3) NOT NULL,
	"status" "entry_status" DEFAULT 'locked'::"entry_status" NOT NULL,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fuel_entries_litres_positive" CHECK ("litres" > 0),
	CONSTRAINT "fuel_entries_unit_cost_non_negative" CHECK ("unit_cost_ghs" >= 0),
	CONSTRAINT "fuel_entries_odometer_order" CHECK ("odometer_start" IS NULL OR "odometer_end" IS NULL OR "odometer_end" >= "odometer_start"),
	CONSTRAINT "fuel_entries_hour_meter_order" CHECK ("hour_meter_start" IS NULL OR "hour_meter_end" IS NULL OR "hour_meter_end" >= "hour_meter_start"),
	CONSTRAINT "fuel_entries_has_meter_reading" CHECK (("odometer_start" IS NOT NULL AND "odometer_end" IS NOT NULL)
        OR ("hour_meter_start" IS NOT NULL AND "hour_meter_end" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "fuel_entry_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"fuel_entry_id" uuid NOT NULL,
	"changes" jsonb NOT NULL,
	"reason" text NOT NULL,
	"status" "correction_status" DEFAULT 'pending'::"correction_status" NOT NULL,
	"requested_by" uuid NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fuel_entry_corrections_review_consistent" CHECK (("status" = 'pending') = ("reviewed_by" IS NULL AND "reviewed_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"phone" text,
	"site_id" uuid,
	"user_id" uuid UNIQUE,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reporting_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"month" date NOT NULL UNIQUE,
	"status" "period_status" DEFAULT 'open'::"period_status" NOT NULL,
	"closed_by" uuid,
	"closed_at" timestamp with time zone,
	CONSTRAINT "reporting_periods_first_of_month" CHECK (EXTRACT(DAY FROM "month") = 1),
	CONSTRAINT "reporting_periods_closed_consistent" CHECK (("status" = 'closed') = ("closed_by" IS NOT NULL AND "closed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"region" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL UNIQUE,
	"contact" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tank_dips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tank_id" uuid NOT NULL,
	"measured_l" numeric(10,2) NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"recorded_by" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tank_dips_measured_non_negative" CHECK ("measured_l" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tank_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text DEFAULT ('INT-' || regexp_replace(lpad(nextval('tank_intakes_code_seq')::text, 12, '0'), '^0{0,9}', '')) NOT NULL UNIQUE,
	"tank_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"delivery_note" text NOT NULL,
	"litres" numeric(10,2) NOT NULL,
	"cost_per_litre" numeric(8,3) NOT NULL,
	"total_cost" numeric(12,2) GENERATED ALWAYS AS (round(litres * cost_per_litre, 2)) STORED,
	"received_by" uuid NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tank_intakes_supplier_delivery_note_key" UNIQUE("supplier_id","delivery_note"),
	CONSTRAINT "tank_intakes_litres_positive" CHECK ("litres" > 0),
	CONSTRAINT "tank_intakes_cost_non_negative" CHECK ("cost_per_litre" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tank_period_balances" (
	"period_id" uuid,
	"tank_id" uuid,
	"opening_l" numeric(10,2) NOT NULL,
	"closing_measured_l" numeric(10,2),
	CONSTRAINT "tank_period_balances_pkey" PRIMARY KEY("period_id","tank_id"),
	CONSTRAINT "tank_period_balances_non_negative" CHECK ("opening_l" >= 0 AND ("closing_measured_l" IS NULL OR "closing_measured_l" >= 0))
);
--> statement-breakpoint
CREATE TABLE "tanks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text DEFAULT ('TNK-' || regexp_replace(lpad(nextval('tanks_code_seq')::text, 12, '0'), '^0{0,10}', '')) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"kind" "tank_kind" NOT NULL,
	"site_id" uuid NOT NULL,
	"capacity_l" numeric(10,2) NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tanks_capacity_positive" CHECK ("capacity_l" > 0)
);
--> statement-breakpoint
CREATE TABLE "theft_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text DEFAULT ('ALR-' || regexp_replace(lpad(nextval('theft_alerts_code_seq')::text, 12, '0'), '^0{0,9}', '')) NOT NULL UNIQUE,
	"equipment_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"rule" "alert_rule" NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"state" "alert_state" DEFAULT 'open'::"alert_state" NOT NULL,
	"variance_pct" numeric(6,2),
	"summary" text NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theft_alerts_resolved_consistent" CHECK (("state" = 'resolved') = ("resolved_by" IS NOT NULL AND "resolved_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text DEFAULT ('USR-' || regexp_replace(lpad(nextval('users_code_seq')::text, 12, '0'), '^0{0,10}', '')) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" "user_role" DEFAULT 'records_taker'::"user_role" NOT NULL,
	"status" "account_status" DEFAULT 'invited'::"account_status" NOT NULL,
	"site_id" uuid,
	"invited_by" uuid,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_records_taker_has_site" CHECK ("role" <> 'records_taker' OR "site_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX "alert_fuel_entries_fuel_entry_idx" ON "alert_fuel_entries" ("fuel_entry_id");--> statement-breakpoint
CREATE INDEX "alert_reads_user_idx" ON "alert_reads" ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" ("entity_type","entity_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "equipment_site_id_idx" ON "equipment" ("site_id");--> statement-breakpoint
CREATE INDEX "equipment_equipment_type_id_idx" ON "equipment" ("equipment_type_id");--> statement-breakpoint
CREATE INDEX "fuel_entries_equipment_dispensed_idx" ON "fuel_entries" ("equipment_id","dispensed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "fuel_entries_tank_dispensed_idx" ON "fuel_entries" ("tank_id","dispensed_at");--> statement-breakpoint
CREATE INDEX "fuel_entries_recorded_by_dispensed_idx" ON "fuel_entries" ("recorded_by","dispensed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "fuel_entries_site_dispensed_idx" ON "fuel_entries" ("site_id","dispensed_at");--> statement-breakpoint
CREATE INDEX "fuel_entries_needs_review_idx" ON "fuel_entries" ("status") WHERE "status" <> 'locked';--> statement-breakpoint
CREATE INDEX "fuel_entry_corrections_entry_idx" ON "fuel_entry_corrections" ("fuel_entry_id");--> statement-breakpoint
CREATE INDEX "fuel_entry_corrections_pending_idx" ON "fuel_entry_corrections" ("created_at") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "tank_dips_tank_measured_idx" ON "tank_dips" ("tank_id","measured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tank_intakes_tank_received_idx" ON "tank_intakes" ("tank_id","received_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tanks_site_id_idx" ON "tanks" ("site_id");--> statement-breakpoint
CREATE INDEX "theft_alerts_state_detected_idx" ON "theft_alerts" ("state","detected_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "theft_alerts_equipment_detected_idx" ON "theft_alerts" ("equipment_id","detected_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (lower("email"));--> statement-breakpoint
CREATE INDEX "users_site_id_idx" ON "users" ("site_id");--> statement-breakpoint
ALTER TABLE "alert_fuel_entries" ADD CONSTRAINT "alert_fuel_entries_alert_id_theft_alerts_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "theft_alerts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "alert_fuel_entries" ADD CONSTRAINT "alert_fuel_entries_fuel_entry_id_fuel_entries_id_fkey" FOREIGN KEY ("fuel_entry_id") REFERENCES "fuel_entries"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "alert_reads" ADD CONSTRAINT "alert_reads_alert_id_theft_alerts_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "theft_alerts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "alert_reads" ADD CONSTRAINT "alert_reads_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "alert_thresholds" ADD CONSTRAINT "alert_thresholds_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_equipment_type_id_equipment_types_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_site_id_sites_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_equipment_id_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_tank_id_tanks_id_fkey" FOREIGN KEY ("tank_id") REFERENCES "tanks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_operator_id_operators_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_site_id_sites_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_recorded_by_users_id_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fuel_entry_corrections" ADD CONSTRAINT "fuel_entry_corrections_fuel_entry_id_fuel_entries_id_fkey" FOREIGN KEY ("fuel_entry_id") REFERENCES "fuel_entries"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fuel_entry_corrections" ADD CONSTRAINT "fuel_entry_corrections_requested_by_users_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fuel_entry_corrections" ADD CONSTRAINT "fuel_entry_corrections_reviewed_by_users_id_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "operators" ADD CONSTRAINT "operators_site_id_sites_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "operators" ADD CONSTRAINT "operators_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD CONSTRAINT "reporting_periods_closed_by_users_id_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tank_dips" ADD CONSTRAINT "tank_dips_tank_id_tanks_id_fkey" FOREIGN KEY ("tank_id") REFERENCES "tanks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tank_dips" ADD CONSTRAINT "tank_dips_recorded_by_users_id_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tank_intakes" ADD CONSTRAINT "tank_intakes_tank_id_tanks_id_fkey" FOREIGN KEY ("tank_id") REFERENCES "tanks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tank_intakes" ADD CONSTRAINT "tank_intakes_supplier_id_suppliers_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tank_intakes" ADD CONSTRAINT "tank_intakes_received_by_users_id_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tank_period_balances" ADD CONSTRAINT "tank_period_balances_period_id_reporting_periods_id_fkey" FOREIGN KEY ("period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tank_period_balances" ADD CONSTRAINT "tank_period_balances_tank_id_tanks_id_fkey" FOREIGN KEY ("tank_id") REFERENCES "tanks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tanks" ADD CONSTRAINT "tanks_site_id_sites_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "theft_alerts" ADD CONSTRAINT "theft_alerts_equipment_id_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "theft_alerts" ADD CONSTRAINT "theft_alerts_site_id_sites_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "theft_alerts" ADD CONSTRAINT "theft_alerts_resolved_by_users_id_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_site_id_sites_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_invited_by_users_id_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE VIEW "v_daily_issuance" AS (
  SELECT
    (dispensed_at AT TIME ZONE 'Africa/Accra')::date AS day,
    site_id,
    sum(litres) AS litres,
    count(*) AS entries
  FROM fuel_entries
  GROUP BY 1, 2
);--> statement-breakpoint
CREATE VIEW "v_equipment_standards" AS (
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
);--> statement-breakpoint
CREATE VIEW "v_monthly_equipment_summary" AS (
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
        AND f.dispensed_at >= p.month::timestamp AT TIME ZONE 'Africa/Accra'
        AND f.dispensed_at < (p.month + interval '1 month') AT TIME ZONE 'Africa/Accra'
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
);--> statement-breakpoint
CREATE VIEW "v_tank_levels" AS (
  SELECT
    tk.id AS tank_id,
    tk.code AS tank_code,
    tk.name,
    tk.site_id,
    tk.capacity_l,
    d.measured_l AS current_l,
    d.measured_at,
    round(d.measured_l / tk.capacity_l * 100, 1) AS fill_pct,
    i.last_refill_at
  FROM tanks tk
  LEFT JOIN LATERAL (
    SELECT measured_l, measured_at FROM tank_dips
    WHERE tank_id = tk.id ORDER BY measured_at DESC LIMIT 1
  ) d ON true
  LEFT JOIN LATERAL (
    SELECT max(received_at) AS last_refill_at FROM tank_intakes WHERE tank_id = tk.id
  ) i ON true
  WHERE tk.archived_at IS NULL
);--> statement-breakpoint
CREATE VIEW "v_tank_reconciliation" AS (
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
      month::timestamp AT TIME ZONE 'Africa/Accra' AS starts_at,
      (month + interval '1 month') AT TIME ZONE 'Africa/Accra' AS ends_at
    FROM reporting_periods
  ) p
  CROSS JOIN tanks tk
  LEFT JOIN tank_period_balances b ON b.period_id = p.id AND b.tank_id = tk.id
  LEFT JOIN LATERAL (
    SELECT sum(litres) AS intake_l FROM tank_intakes
    WHERE tank_id = tk.id AND received_at >= p.starts_at AND received_at < p.ends_at
  ) i ON true
  LEFT JOIN LATERAL (
    SELECT sum(litres) AS issued_l FROM fuel_entries
    WHERE tank_id = tk.id AND dispensed_at >= p.starts_at AND dispensed_at < p.ends_at
  ) f ON true
  LEFT JOIN LATERAL (
    SELECT measured_l FROM tank_dips
    WHERE tank_id = tk.id AND measured_at < p.ends_at
    ORDER BY measured_at DESC LIMIT 1
  ) d ON true
  WHERE tk.archived_at IS NULL
);