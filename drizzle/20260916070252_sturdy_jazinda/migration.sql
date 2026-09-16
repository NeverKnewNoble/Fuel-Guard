DROP VIEW "v_tank_levels";--> statement-breakpoint
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
        WHERE tank_id = tk.id AND (d.measured_at IS NULL OR received_at > d.measured_at)) AS intake_l,
      (SELECT sum(litres) FROM fuel_entries
        WHERE tank_id = tk.id AND (d.measured_at IS NULL OR dispensed_at > d.measured_at)) AS issued_l
  ) m ON true
  LEFT JOIN LATERAL (
    SELECT max(received_at) AS last_refill_at FROM tank_intakes WHERE tank_id = tk.id
  ) i ON true
  WHERE tk.archived_at IS NULL
);