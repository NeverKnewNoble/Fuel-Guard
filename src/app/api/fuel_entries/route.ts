import { withActor } from "@/app/api/_lib/routeHandler";
import { FuelEntryService } from "@/services/fuelEntryService";
import type { EntryStatus } from "@/types/fuelLog";
import { oneOf } from "@/utils/actionUtils";

const STATUSES: EntryStatus[] = ["locked", "watch", "flagged"];

/**
 * `LogEntryRow[]`: recent entries, newest first. A records taker only gets their own;
 * an administrator gets everyone's. `?status=` filters by the page's tabs.
 */
export const GET = withActor(({ actor, request }) => {
  const status = oneOf(new URL(request.url).searchParams.get("status"), STATUSES);
  return FuelEntryService.listRecent({ actor, status });
});
