import { type SQL, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { PgColumn } from "drizzle-orm/pg-core";

export const TIME_ZONE = "Africa/Accra";

/** Postgres returns numeric columns as strings (e.g. "210.00"). Convert once, in the service. */
export const toNumber = (v: string | null) => (v === null ? null : Number(v));

/** For inserts into numeric columns. */
export const toNumeric = (n: number, scale = 2) => n.toFixed(scale);

/** `toNumeric` that passes `null`/`undefined` through as `null`. */
export const toNumericOrNull = (n: number | null | undefined, scale = 2) => (n === null || n === undefined ? null : n.toFixed(scale));

/** Pads the result of a count(*) — Postgres returns bigint counts as strings. */
export const toCount = (v: unknown) => Number(v ?? 0);

export const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

/** First day of the month containing `date`, in Accra time, as 'YYYY-MM-01'. */
export function monthStart(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" })
    .formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}-01`;
}

/** The Accra calendar day containing `date`, as 'YYYY-MM-DD'. */
export function accraDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** 'YYYY-MM-01' → the following month's 'YYYY-MM-01'. */
export function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** 'YYYY-MM-DD' → the following day's 'YYYY-MM-DD'. */
export function nextDay(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-01' → "September 2024". */
export const formatMonth = (month: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${month}T00:00:00Z`));

/** For "Sep 1" chart labels. */
export const shortDate = (d: Date | string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, month: "short", day: "numeric" }).format(new Date(d));

/** "7,250" — for litres in user-facing messages. */
export const formatLitres = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 2 });

/** SQL condition: `column` (a timestamptz) falls inside the Accra calendar month starting `month` ('YYYY-MM-01'). */
export function inAccraMonth(column: PgColumn | SQL, month: string) {
  return sql`${column} >= (${month}::date)::timestamp at time zone ${sql.raw(`'${TIME_ZONE}'`)}
    and ${column} < (${month}::date + interval '1 month') at time zone ${sql.raw(`'${TIME_ZONE}'`)}`;
}

/** A list of queries for `db.batch`, which needs at least one. */
export type BatchWrites = [BatchItem<"pg">, ...BatchItem<"pg">[]];

/** Allows up to 5 minutes of clock drift between the browser and the server. */
export const isInFuture = (date: Date) => date.getTime() > Date.now() + 5 * 60 * 1000;

export const isValidDate = (date: unknown): date is Date => date instanceof Date && !Number.isNaN(date.getTime());

export const isPositive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

export const isNonNegative = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
