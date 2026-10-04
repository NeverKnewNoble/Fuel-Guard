CREATE SEQUENCE "public"."tank_transfers_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "tank_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text DEFAULT ('TRF-' || regexp_replace(lpad(nextval('tank_transfers_code_seq')::text, 12, '0'), '^0{0,9}', '')) NOT NULL UNIQUE,
	"from_tank_id" uuid NOT NULL,
	"to_tank_id" uuid NOT NULL,
	"litres" numeric(10,2) NOT NULL,
	"transferred_by" uuid NOT NULL,
	"transferred_at" timestamp with time zone NOT NULL,
	"note" text,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tank_transfers_litres_positive" CHECK ("litres" > 0),
	CONSTRAINT "tank_transfers_different_tanks" CHECK ("from_tank_id" <> "to_tank_id"),
	CONSTRAINT "tank_transfers_void_consistent" CHECK (("voided_at" IS NULL) = ("voided_by" IS NULL) AND ("voided_at" IS NOT NULL OR "void_reason" IS NULL))
);
--> statement-breakpoint
DROP VIEW "v_tank_levels";--> statement-breakpoint
DROP VIEW "v_tank_reconciliation";--> statement-breakpoint
CREATE INDEX "tank_transfers_from_tank_idx" ON "tank_transfers" ("from_tank_id","transferred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tank_transfers_to_tank_idx" ON "tank_transfers" ("to_tank_id","transferred_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "tank_transfers" ADD CONSTRAINT "tank_transfers_from_tank_id_tanks_id_fkey" FOREIGN KEY ("from_tank_id") REFERENCES "tanks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tank_transfers" ADD CONSTRAINT "tank_transfers_to_tank_id_tanks_id_fkey" FOREIGN KEY ("to_tank_id") REFERENCES "tanks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tank_transfers" ADD CONSTRAINT "tank_transfers_transferred_by_users_id_fkey" FOREIGN KEY ("transferred_by") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "tank_transfers" ADD CONSTRAINT "tank_transfers_voided_by_users_id_fkey" FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
CREATE VIEW "v_tank_levels" AS (
  SELECT
    tk.id AS tank_id,
    tk.code AS tank_code,
    tk.name,
    tk.site_id,
    tk.capacity_l,
    COALESCE(d.measured_l, 0) + COALESCE(m.intake_l, 0) - COALESCE(m.issued_l, 0)
      + COALESCE(m.transfer_in_l, 0) - COALESCE(m.transfer_out_l, 0) AS current_l,
    d.measured_l,
    d.measured_at,
    COALESCE(m.intake_l, 0) - COALESCE(m.issued_l, 0)
      + COALESCE(m.transfer_in_l, 0) - COALESCE(m.transfer_out_l, 0) AS since_dip_l,
    round(
      (COALESCE(d.measured_l, 0) + COALESCE(m.intake_l, 0) - COALESCE(m.issued_l, 0)
        + COALESCE(m.transfer_in_l, 0) - COALESCE(m.transfer_out_l, 0)) / tk.capacity_l * 100,
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
          AND (d.measured_at IS NULL OR dispensed_at > d.measured_at)) AS issued_l,
      (SELECT sum(litres) FROM tank_transfers
        WHERE to_tank_id = tk.id AND voided_at IS NULL
          AND (d.measured_at IS NULL OR transferred_at > d.measured_at)) AS transfer_in_l,
      (SELECT sum(litres) FROM tank_transfers
        WHERE from_tank_id = tk.id AND voided_at IS NULL
          AND (d.measured_at IS NULL OR transferred_at > d.measured_at)) AS transfer_out_l
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
    COALESCE(x.transfer_in_l, 0) AS transfer_in_l,
    COALESCE(x.transfer_out_l, 0) AS transfer_out_l,
    COALESCE(b.opening_l, 0) + COALESCE(i.intake_l, 0) - COALESCE(f.issued_l, 0)
      + COALESCE(x.transfer_in_l, 0) - COALESCE(x.transfer_out_l, 0) AS expected_l,
    COALESCE(b.closing_measured_l, d.measured_l) AS measured_l,
    COALESCE(b.closing_measured_l, d.measured_l)
      - (COALESCE(b.opening_l, 0) + COALESCE(i.intake_l, 0) - COALESCE(f.issued_l, 0)
        + COALESCE(x.transfer_in_l, 0) - COALESCE(x.transfer_out_l, 0)) AS variance_l
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
    SELECT
      sum(litres) FILTER (WHERE to_tank_id = tk.id) AS transfer_in_l,
      sum(litres) FILTER (WHERE from_tank_id = tk.id) AS transfer_out_l
    FROM tank_transfers
    WHERE (to_tank_id = tk.id OR from_tank_id = tk.id) AND voided_at IS NULL
      AND transferred_at >= p.starts_at AND transferred_at < p.ends_at
  ) x ON true
  LEFT JOIN LATERAL (
    SELECT measured_l FROM tank_dips
    WHERE tank_id = tk.id AND measured_at < p.ends_at
    ORDER BY measured_at DESC LIMIT 1
  ) d ON true
  WHERE tk.archived_at IS NULL
);