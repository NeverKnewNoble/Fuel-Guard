import { DataCardSkeleton, LoadingRegion, PageHeaderSkeleton, StatTilesSkeleton } from "@/components/ui/skeleton";

export default function TheftAlertsLoading() {
  return (
    <LoadingRegion label="Loading alerts…" className="mx-auto w-full max-w-5xl">
      <PageHeaderSkeleton />
      <StatTilesSkeleton count={4} className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4" />
      <div className="mt-4">
        <DataCardSkeleton body="list" rows={6} action />
      </div>
    </LoadingRegion>
  );
}
