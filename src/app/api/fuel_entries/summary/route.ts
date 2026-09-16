import { withActor } from "@/app/api/_lib/routeHandler";
import { FuelEntryService } from "@/services/fuelEntryService";

/** The Fuel Entry page's tiles and tab counts cover the last two days, matching its "Last 2 days" hint. */
export const SUMMARY_DAYS = 2;

/** `FuelEntrySummary`: totals for the signed-in user's entries (all entries, for an administrator). */
export const GET = withActor(({ actor }) =>
  FuelEntryService.getSummary({ actor, since: new Date(Date.now() - SUMMARY_DAYS * 24 * 60 * 60 * 1000) })
);
