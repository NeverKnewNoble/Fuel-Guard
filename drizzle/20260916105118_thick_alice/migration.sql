DROP VIEW "v_daily_issuance";--> statement-breakpoint
DROP VIEW "v_monthly_equipment_summary";--> statement-breakpoint
DROP VIEW "v_tank_levels";--> statement-breakpoint
DROP VIEW "v_tank_reconciliation";--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD COLUMN "voided_by" uuid;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "tank_intakes" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tank_intakes" ADD COLUMN "voided_by" uuid;--> statement-breakpoint
ALTER TABLE "tank_intakes" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_voided_by_users_id_fkey" FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tank_intakes" ADD CONSTRAINT "tank_intakes_voided_by_users_id_fkey" FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_void_consistent" CHECK (("voided_at" IS NULL) = ("voided_by" IS NULL) AND ("voided_at" IS NOT NULL OR "void_reason" IS NULL));--> statement-breakpoint
ALTER TABLE "tank_intakes" ADD CONSTRAINT "tank_intakes_void_consistent" CHECK (("voided_at" IS NULL) = ("voided_by" IS NULL) AND ("voided_at" IS NOT NULL OR "void_reason" IS NULL));--> statement-breakpoint
CREATE VIEW "v_daily_issuance" AS (
  SELECT
    (dispensed_at AT TIME ZONE 'Africa/Accra')::date AS day,
    site_id,
    sum(litres) AS litres,
    count(*) AS entries
  FROM fuel_entries
  WHERE voided_at IS NULL
  GROUP BY 1, 2
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
        AND f.voided_at IS NULL
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
);