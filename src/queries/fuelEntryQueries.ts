import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiFetch";
import { queryKeys } from "@/queries/keys";
import type { EquipmentFormOption } from "@/types/equipment";
import type { EntryStatus, FuelEntryDetail, FuelEntrySummary, LogEntryRow, PendingCorrectionRow } from "@/types/fuelLog";
import type { OperatorOption } from "@/types/operator";

export const fuelEntriesQuery = (filters: { status?: EntryStatus } = {}) =>
  queryOptions({
    queryKey: queryKeys.fuelEntries.list(filters),
    queryFn: () =>
      apiFetch<LogEntryRow[]>(`/api/fuel_entries${filters.status ? `?status=${filters.status}` : ""}`),
  });

export const fuelEntrySummaryQuery = () =>
  queryOptions({
    queryKey: queryKeys.fuelEntries.summary(),
    queryFn: () => apiFetch<FuelEntrySummary>("/api/fuel_entries/summary"),
  });

export const fuelEntryDetailQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.fuelEntries.detail(id),
    queryFn: () => apiFetch<FuelEntryDetail>(`/api/fuel_entries/${encodeURIComponent(id)}`),
  });

export const pendingCorrectionsQuery = () =>
  queryOptions({
    queryKey: queryKeys.corrections.pending(),
    queryFn: () => apiFetch<PendingCorrectionRow[]>("/api/corrections/pending"),
  });

/** Units that can draw fuel, for the New Fuel Entry form. */
export const equipmentOptionsQuery = () =>
  queryOptions({
    queryKey: [...queryKeys.equipment.all, "options"] as const,
    queryFn: () => apiFetch<EquipmentFormOption[]>("/api/equipment/options"),
  });

export const operatorsQuery = () =>
  queryOptions({
    queryKey: queryKeys.operators.active(),
    queryFn: () => apiFetch<OperatorOption[]>("/api/operators"),
  });
