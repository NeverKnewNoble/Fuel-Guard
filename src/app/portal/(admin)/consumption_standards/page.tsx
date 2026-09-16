import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import EquipmentTypesCard from "@/components/standards/equipmentTypesCard";
import ThresholdsCard from "@/components/standards/thresholdsCard";
import PageHeader from "@/components/ui/pageHeader";
import { getQueryClient, prefetch } from "@/queries/queryClient";
import { equipmentTypesQuery, thresholdsQuery } from "@/queries/standardsQueries";
import { AlertThresholdService } from "@/services/alertThresholdService";
import { EquipmentTypeService } from "@/services/equipmentTypeService";

export default async function ConsumptionStandardsPage() {
  // Prefetch on the server by calling the services directly, so the cards render with data on the first paint.
  // The client cache takes over from here; a failed prefetch just leaves the card to fetch (and show its error) itself.
  const queryClient = getQueryClient();
  await Promise.all([
    prefetch(queryClient, { ...thresholdsQuery(), queryFn: () => AlertThresholdService.listIfConfigured() }),
    prefetch(queryClient, { ...equipmentTypesQuery(), queryFn: () => EquipmentTypeService.list() }),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        eyebrow="Set-up"
        title="Consumption Standards"
        description="Set L/km and L/hr targets by equipment type. Variances beyond these thresholds trigger automatic alerts."
      />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <div className="mt-7 space-y-4">
          <ThresholdsCard />
          <EquipmentTypesCard />
        </div>
      </HydrationBoundary>
    </div>
  );
}
