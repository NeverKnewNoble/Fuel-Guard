import type { AlertState } from "@/types/alerts";
import type { EntryStatus } from "@/types/fuelLog";

/**
 * Every query key in one place. Keys are hierarchical, so invalidating a parent
 * (e.g. `queryKeys.standards.all`) refreshes every query beneath it.
 */
export const queryKeys = {
  standards: {
    all: ["standards"] as const,
    thresholds: () => [...queryKeys.standards.all, "thresholds"] as const,
    equipmentTypes: () => [...queryKeys.standards.all, "equipment-types"] as const,
  },
  sites: {
    all: ["sites"] as const,
    list: () => [...queryKeys.sites.all, "list"] as const,
    usage: () => [...queryKeys.sites.all, "usage"] as const,
  },
  equipment: {
    // Equipment rows show each type's effective standard, so standards changes refresh these too.
    all: ["equipment"] as const,
    list: () => [...queryKeys.equipment.all, "list"] as const,
    stats: () => [...queryKeys.equipment.all, "stats"] as const,
    detail: (id: string) => [...queryKeys.equipment.all, "detail", id] as const,
  },
  me: ["me"] as const,
  users: {
    all: ["users"] as const,
    list: () => [...queryKeys.users.all, "list"] as const,
    stats: () => [...queryKeys.users.all, "stats"] as const,
  },
  tanks: {
    // Levels come from dips, so recording a dip refreshes everything here.
    all: ["tanks"] as const,
    list: () => [...queryKeys.tanks.all, "list"] as const,
    options: () => [...queryKeys.tanks.all, "options"] as const,
    detail: (id: string) => [...queryKeys.tanks.all, "detail", id] as const,
    dips: (id: string) => [...queryKeys.tanks.all, "dips", id] as const,
  },
  reconciliation: {
    all: ["reconciliation"] as const,
    current: () => [...queryKeys.reconciliation.all, "current"] as const,
  },
  intakes: {
    all: ["intakes"] as const,
    list: () => [...queryKeys.intakes.all, "list"] as const,
  },
  suppliers: {
    all: ["suppliers"] as const,
    list: () => [...queryKeys.suppliers.all, "list"] as const,
  },
  operators: {
    all: ["operators"] as const,
    active: () => [...queryKeys.operators.all, "active"] as const,
  },
  fuelEntries: {
    all: ["fuel-entries"] as const,
    // One cache entry per filter tab; invalidating `all` refreshes every tab.
    list: (filters: { status?: EntryStatus } = {}) => [...queryKeys.fuelEntries.all, "list", filters] as const,
    summary: () => [...queryKeys.fuelEntries.all, "summary"] as const,
    detail: (id: string) => [...queryKeys.fuelEntries.all, "detail", id] as const,
  },
  corrections: {
    all: ["corrections"] as const,
    pending: () => [...queryKeys.corrections.all, "pending"] as const,
  },
  alerts: {
    all: ["alerts"] as const,
    list: (filters: { state?: AlertState } = {}) => [...queryKeys.alerts.all, "list", filters] as const,
    counts: () => [...queryKeys.alerts.all, "counts"] as const,
    unreadCount: () => [...queryKeys.alerts.all, "unread-count"] as const,
  },
  reportingPeriods: {
    all: ["reporting-periods"] as const,
    list: () => [...queryKeys.reportingPeriods.all, "list"] as const,
  },
  monthlySummary: {
    all: ["monthly-summary"] as const,
    report: (periodId: string) => [...queryKeys.monthlySummary.all, "report", periodId] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
  },
};
