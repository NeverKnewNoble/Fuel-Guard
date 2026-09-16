import { uuidParam } from "@/app/api/_lib/params";
import { withActor } from "@/app/api/_lib/routeHandler";
import { FuelEntryService } from "@/services/fuelEntryService";

/** `FuelEntryDetail`: one entry with its equipment, alerts and correction history. */
export const GET = withActor<RouteContext<"/api/fuel_entries/[id]">>(async ({ actor, context }) =>
  FuelEntryService.getById(uuidParam((await context.params).id, "Fuel entry"), actor)
);
