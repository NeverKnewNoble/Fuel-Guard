/** A failed `/api` request. `fields` maps form field names to messages, when the server sent them. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly fields?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// `Response.json` turns Dates into ISO strings like "2026-09-15T10:40:00.000Z". Date-only values ("2026-09-01") stay strings.
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const reviveDates = (_key: string, value: unknown) =>
  typeof value === "string" && ISO_DATE_TIME.test(value) ? new Date(value) : value;

/**
 * GETs JSON from one of our route handlers for a TanStack Query `queryFn`.
 * Dates come back as `Date` objects, so the result matches the service's return type.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text, reviveDates) : null;
  } catch {
    // Not JSON (e.g. a proxy error page); handled below.
  }

  if (!response.ok) {
    const error = (body ?? {}) as { error?: string; code?: string; fields?: Record<string, string> };
    throw new ApiError(error.error ?? "Something went wrong. Please try again.", response.status, error.code, error.fields);
  }
  return body as T;
}
