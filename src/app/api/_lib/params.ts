import { NotFoundError } from "@/services/errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns `id` if it's a uuid, otherwise throws `NotFoundError(what)`.
 * A malformed id would otherwise reach Postgres as an invalid uuid and surface as a 500.
 */
export function uuidParam(id: string, what: string) {
  if (!UUID.test(id)) throw new NotFoundError(what);
  return id;
}
