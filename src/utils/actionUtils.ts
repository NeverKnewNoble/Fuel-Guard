import { ServiceError, ValidationError } from "@/services/errors";
import type { ActionState } from "@/types/actions";

/**
 * Helpers shared by the portal's server actions (`actions.ts` files).
 * See docs/data-fetching.md §5.
 */

/** A `ServiceError` becomes `{ ok: false }` for the form; anything else is a bug, so it rethrows. */
export function toErrorState(error: unknown): ActionState {
  if (error instanceof ServiceError) {
    return { ok: false, error: error.message, fields: error instanceof ValidationError ? error.fields : undefined };
  }
  throw error;
}

/** Trimmed text; missing becomes "". */
export const formText = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** Trimmed text, or `null` when empty. */
export const optionalText = (v: FormDataEntryValue | null) => formText(v) || null;

/** Empty becomes NaN, which the services reject with a field message. */
export const requiredNumber = (v: FormDataEntryValue | null) => (v === null || v === "" ? Number.NaN : Number(v));

/** Empty becomes `null` (e.g. to clear an optional value). */
export const optionalNumber = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));

/**
 * A form's separate date ("2026-09-15") and time ("14:05") inputs as a `Date`, read as Accra wall-clock time.
 * Accra is UTC+0 all year, so the wall-clock time is the UTC time. Anything malformed gives an Invalid Date,
 * which the services reject with a field message.
 */
export function accraDateTime(date: FormDataEntryValue | null, time: FormDataEntryValue | null) {
  const d = formText(date);
  const t = formText(time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(t)) return new Date(Number.NaN);
  return new Date(`${d}T${t}:00Z`);
}

/** Narrows an untrusted value to one of `allowed`, or `undefined`. Server actions can be called with anything. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}
