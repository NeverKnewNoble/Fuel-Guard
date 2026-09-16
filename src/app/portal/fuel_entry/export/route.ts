import { ServiceError } from "@/services/errors";
import { FuelEntryService } from "@/services/fuelEntryService";
import { SessionService } from "@/services/sessionService";
import type { EntryStatus } from "@/types/fuelLog";

const STATUSES = ["locked", "flagged", "watch"] as const;
const isStatus = (value: string | null): value is EntryStatus => STATUSES.includes(value as EntryStatus);

/**
 * Downloads the daily fuel log as CSV: `/portal/fuel_entry/export`.
 * Add `?status=flagged` for one tab, or `?id=<uuid>` (repeatable) for the selected rows.
 * Scoped by actor the same way the list is, so a records taker only ever exports their own entries.
 */
export async function GET(request: Request) {
  try {
    const actor = await SessionService.requireUser();

    const params = new URL(request.url).searchParams;
    const status = params.get("status");
    const ids = params.getAll("id").filter(Boolean);

    const csv = await FuelEntryService.toCsv({
      actor,
      status: isStatus(status) ? status : undefined,
      ids: ids.length > 0 ? ids : undefined,
    });

    const today = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fuelguard-fuel-log-${today}.csv"`,
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
