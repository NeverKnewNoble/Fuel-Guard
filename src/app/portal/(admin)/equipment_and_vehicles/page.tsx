import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import EquipmentRegistryCard from "@/components/equipment/equipmentRegistryCard";
import EquipmentStats from "@/components/equipment/equipmentStats";
import { AddEquipmentButton } from "@/components/modals/triggers";
import PageHeader from "@/components/ui/pageHeader";
import { equipmentListQuery, equipmentStatsQuery } from "@/queries/equipmentQueries";
import { getQueryClient, prefetch } from "@/queries/queryClient";
import { sitesQuery } from "@/queries/siteQueries";
import { equipmentTypesQuery } from "@/queries/standardsQueries";
import { EquipmentService } from "@/services/equipmentService";
import { EquipmentTypeService } from "@/services/equipmentTypeService";
import { SiteService } from "@/services/siteService";

export default async function EquipmentAndVehiclesPage() {
  // Types and sites feed the Add Equipment form, so it opens with its selects filled.
  const queryClient = getQueryClient();
  await Promise.all([
    prefetch(queryClient, { ...equipmentListQuery(), queryFn: () => EquipmentService.list() }),
    prefetch(queryClient, { ...equipmentStatsQuery(), queryFn: () => EquipmentService.getStats() }),
    prefetch(queryClient, { ...equipmentTypesQuery(), queryFn: () => EquipmentTypeService.list() }),
    prefetch(queryClient, { ...sitesQuery(), queryFn: () => SiteService.list() }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PageHeader
          eyebrow="Set-up"
          title="Equipment & Vehicles"
          // description="Every unit that draws fuel across all sites, with the standard its entries are checked against."
          action={<AddEquipmentButton />}
        />

        <EquipmentStats />

        <div className="mt-4">
          <EquipmentRegistryCard />
        </div>
      </HydrationBoundary>
    </div>
  );
}
