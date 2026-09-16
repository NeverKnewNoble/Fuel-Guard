import { ServiceError, ValidationError } from "@/services/errors";
import { SessionService } from "@/services/sessionService";
import type { Actor } from "@/types/user";

const STATUS_BY_CODE: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 422,
};

// User data: never let a browser or proxy cache it. TanStack Query does the caching on the client.
const HEADERS = { "Cache-Control": "private, no-store" };

type HandlerArgs<TContext> = { actor: Actor; request: Request; context: TContext };

/**
 * Wraps a read-only route handler: checks the session (and the admin role with `admin: true`),
 * returns the result as JSON, and turns a `ServiceError` into a JSON error with the matching status.
 *
 *   export const GET = withActor(({ actor }) => FuelEntryService.listRecent({ actor }));
 */
export function withActor<TContext = unknown>(
  handler: (args: HandlerArgs<TContext>) => Promise<unknown>,
  options: { admin?: boolean } = {}
) {
  return async (request: Request, context: TContext) => {
    try {
      const actor = options.admin ? await SessionService.requireAdmin() : await SessionService.requireUser();
      const data = await handler({ actor, request, context });
      return Response.json(data ?? null, { headers: HEADERS });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

function errorResponse(error: unknown) {
  if (error instanceof ServiceError) {
    return Response.json(
      { error: error.message, code: error.code, fields: error instanceof ValidationError ? error.fields : undefined },
      { status: STATUS_BY_CODE[error.code] ?? 400, headers: HEADERS }
    );
  }
  // Unexpected: log the detail on the server, send the client a generic message.
  console.error(error);
  return Response.json(
    { error: "Something went wrong. Please try again.", code: "SERVER_ERROR" },
    { status: 500, headers: HEADERS }
  );
}
