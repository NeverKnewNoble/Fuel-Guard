import { withActor } from "@/app/api/_lib/routeHandler";
import { DashboardService } from "@/services/dashboardService";

/** `DashboardOverview`: KPIs, both charts, the watchlist and recent entries, in one request. */
export const GET = withActor(({ actor }) => DashboardService.getOverview(actor), { admin: true });
