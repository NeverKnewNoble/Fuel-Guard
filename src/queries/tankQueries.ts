import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiFetch";
import { queryKeys } from "@/queries/keys";
import type { SupplierOption } from "@/types/supplier";
import type { IntakeRow, ReconciliationReport, TankCardData, TankDetail, TankDipRow, TankOption, TransferRow } from "@/types/tank";

export const tanksQuery = () =>
  queryOptions({
    queryKey: queryKeys.tanks.list(),
    queryFn: () => apiFetch<TankCardData[]>("/api/tanks"),
  });

export const tankOptionsQuery = () =>
  queryOptions({
    queryKey: queryKeys.tanks.options(),
    queryFn: () => apiFetch<TankOption[]>("/api/tanks/options"),
  });

export const tankDetailQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.tanks.detail(id),
    queryFn: () => apiFetch<TankDetail>(`/api/tanks/${encodeURIComponent(id)}`),
  });

export const tankDipsQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.tanks.dips(id),
    queryFn: () => apiFetch<TankDipRow[]>(`/api/tanks/${encodeURIComponent(id)}/dips`),
  });

export const reconciliationQuery = () =>
  queryOptions({
    queryKey: queryKeys.reconciliation.current(),
    queryFn: () => apiFetch<ReconciliationReport>("/api/reconciliation"),
  });

export const intakesQuery = () =>
  queryOptions({
    queryKey: queryKeys.intakes.list(),
    queryFn: () => apiFetch<IntakeRow[]>("/api/intakes"),
  });

export const transfersQuery = () =>
  queryOptions({
    queryKey: queryKeys.transfers.list(),
    queryFn: () => apiFetch<TransferRow[]>("/api/transfers"),
  });

export const suppliersQuery = () =>
  queryOptions({
    queryKey: queryKeys.suppliers.list(),
    queryFn: () => apiFetch<SupplierOption[]>("/api/suppliers"),
  });
