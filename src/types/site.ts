import type { sites } from "@/db/schema";

export type SiteRow = typeof sites.$inferSelect;

export type SiteOption = { id: string; code: string; name: string; region: string | null };

/** One row of the Sites page: the site plus what's based there. */
export type SiteUsageRow = {
  id: string;
  code: string;
  name: string;
  region: string | null;
  archivedAt: Date | null;
  /** Units that aren't retired. */
  equipmentCount: number;
  /** Tankers that aren't archived. */
  tankCount: number;
};

export type CreateSiteInput = { code: string; name: string; region?: string };

export type UpdateSiteInput = { name?: string; region?: string | null };
