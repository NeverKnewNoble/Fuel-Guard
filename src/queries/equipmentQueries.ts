import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiFetch";
import { queryKeys } from "@/queries/keys";
import type { EquipmentDetail, EquipmentRow, EquipmentStats } from "@/types/equipment";

export const equipmentListQuery = () =>
  queryOptions({
    queryKey: queryKeys.equipment.list(),
    queryFn: () => apiFetch<EquipmentRow[]>("/api/equipment"),
  });

export const equipmentStatsQuery = () =>
  queryOptions({
    queryKey: queryKeys.equipment.stats(),
    queryFn: () => apiFetch<EquipmentStats>("/api/equipment/stats"),
  });

export const equipmentDetailQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.equipment.detail(id),
    queryFn: () => apiFetch<EquipmentDetail>(`/api/equipment/${encodeURIComponent(id)}`),
  });
