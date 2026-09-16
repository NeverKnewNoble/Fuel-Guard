import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiFetch";
import { queryKeys } from "@/queries/keys";
import type { AlertThreshold, EquipmentTypeRow } from "@/types/standards";

/**
 * Query definitions for Consumption Standards. Client components use them as-is with `useQuery`.
 * Server pages prefetch with the same key but call the service directly:
 *   queryClient.prefetchQuery({ ...thresholdsQuery(), queryFn: () => AlertThresholdService.listIfConfigured() })
 */
export const thresholdsQuery = () =>
  queryOptions({
    queryKey: queryKeys.standards.thresholds(),
    queryFn: () => apiFetch<AlertThreshold[] | null>("/api/alert_thresholds"),
  });

export const equipmentTypesQuery = () =>
  queryOptions({
    queryKey: queryKeys.standards.equipmentTypes(),
    queryFn: () => apiFetch<EquipmentTypeRow[]>("/api/equipment_types"),
  });
