import { uuidParam } from "@/app/api/_lib/params";
import { withActor } from "@/app/api/_lib/routeHandler";
import { MonthlySummaryService } from "@/services/monthlySummaryService";

/** `MonthlyReport`: per-equipment rows and the month's totals. */
export const GET = withActor<RouteContext<"/api/monthly_summary/[periodId]">>(
  async ({ context }) => MonthlySummaryService.getReport(uuidParam((await context.params).periodId, "Reporting period")),
  { admin: true }
);
