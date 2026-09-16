import { uuidParam } from "@/app/api/_lib/params";
import { MonthlySummaryService } from "@/services/monthlySummaryService";
import { ReportingPeriodService } from "@/services/reportingPeriodService";
import { SessionService } from "@/services/sessionService";
import { ServiceError } from "@/services/errors";

/**
 * Downloads the month's breakdown as CSV: `/portal/monthly_summary/export?period=<id>`.
 * Add `&equipment=<id>` (repeatable) to export only the selected rows.
 * A Route Handler, not a server action, so the browser can save the response as a file.
 */
export async function GET(request: Request) {
  try {
    const actor = await SessionService.requireAdmin();
    void actor;

    const params = new URL(request.url).searchParams;
    const periodId = uuidParam(params.get("period") ?? "", "Reporting period");
    const equipmentIds = params.getAll("equipment").filter(Boolean);

    const [period, csv] = await Promise.all([
      ReportingPeriodService.getById(periodId),
      MonthlySummaryService.toCsv(periodId, equipmentIds.length > 0 ? equipmentIds : undefined),
    ]);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fuelguard-${period.month.slice(0, 7)}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    // Plain text: this response is a file download, not something a query reads.
    if (error instanceof ServiceError) return new Response(error.message, { status: 400 });
    console.error(error);
    return new Response("Something went wrong. Please try again.", { status: 500 });
  }
}
