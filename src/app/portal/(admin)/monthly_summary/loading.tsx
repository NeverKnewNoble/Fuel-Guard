import { DataCardSkeleton, LoadingRegion, PageHeaderSkeleton, StatTilesSkeleton } from "@/components/ui/skeleton";

export default function MonthlySummaryLoading() {
  return (
    <LoadingRegion label="Loading monthly summary…" className="mx-auto w-full max-w-7xl">
      <PageHeaderSkeleton actions={2} />
      <StatTilesSkeleton count={3} className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3" />
      <div className="mt-4">
        <DataCardSkeleton rows={8} columns={10} />
      </div>
    </LoadingRegion>
  );
}
