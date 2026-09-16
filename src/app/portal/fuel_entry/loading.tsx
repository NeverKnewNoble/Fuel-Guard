import { DataCardSkeleton, LoadingRegion, PageHeaderSkeleton, Skeleton, StatTilesSkeleton } from "@/components/ui/skeleton";

export default function FuelEntryLoading() {
  return (
    <LoadingRegion label="Loading fuel entries…" className="mx-auto w-full max-w-6xl">
      <PageHeaderSkeleton />
      <StatTilesSkeleton count={4} className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4" />
      {/* Filter tabs and the New Fuel Entry button */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-11 w-full rounded-xl sm:w-80" />
        <Skeleton className="h-11 w-full rounded-xl sm:w-40" />
      </div>
      <div className="mt-6">
        <DataCardSkeleton rows={6} columns={6} />
      </div>
    </LoadingRegion>
  );
}
