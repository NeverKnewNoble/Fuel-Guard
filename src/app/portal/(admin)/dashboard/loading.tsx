import { DataCardSkeleton, LoadingRegion, PageHeaderSkeleton, StatTilesSkeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <LoadingRegion label="Loading dashboard…" className="mx-auto w-full max-w-7xl">
      <PageHeaderSkeleton action />
      <StatTilesSkeleton count={4} className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4" />
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DataCardSkeleton body="chart" />
        <DataCardSkeleton body="chart" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DataCardSkeleton body="list" rows={5} action />
        <DataCardSkeleton body="list" rows={5} action />
      </div>
    </LoadingRegion>
  );
}
