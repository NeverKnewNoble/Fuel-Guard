export class ServiceError extends Error {
  constructor(message: string, public readonly code: string = "SERVICE_ERROR") {
    super(message);
    this.name = new.target.name;
  }
}

/** Not signed in. */
export class UnauthorizedError extends ServiceError {
  constructor(message = "Please sign in again.") {
    super(message, "UNAUTHORIZED");
  }
}

/** Signed in, but the role or site doesn't allow this. */
export class ForbiddenError extends ServiceError {
  constructor(message = "You don't have permission to do that.") {
    super(message, "FORBIDDEN");
  }
}

export class NotFoundError extends ServiceError {
  constructor(what: string) {
    super(`${what} was not found.`, "NOT_FOUND");
  }
}

/** Input breaks a rule. `fields` maps form field names to messages. */
export class ValidationError extends ServiceError {
  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message, "VALIDATION");
  }
}

/** For `.catch(nullIfNotFound)`: turns a `NotFoundError` into `null` and rethrows anything else. */
export function nullIfNotFound(error: unknown): null {
  if (error instanceof NotFoundError) return null;
  throw error;
}

/** Throws one `ValidationError` holding every field problem, using the first message as the summary. */
export function throwIfInvalid(fields: Record<string, string>) {
  const messages = Object.values(fields);
  if (messages.length > 0) throw new ValidationError(messages[0], fields);
}

/** Duplicate or state clash (e.g. email already used, alert already resolved). */
export class ConflictError extends ServiceError {
  constructor(message: string) {
    super(message, "CONFLICT");
  }
}

/** Postgres unique-violation check — Drizzle wraps driver errors, so look at `cause` too. */
export function isUniqueViolation(error: unknown, constraint?: string) {
  const e = error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = e?.code ?? e?.cause?.code;
  const name = e?.constraint ?? e?.cause?.constraint;
  return code === "23505" && (!constraint || name === constraint);
}
