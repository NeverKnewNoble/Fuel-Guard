import { DataCardSkeleton, LoadingRegion, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function ConsumptionStandardsLoading() {
  return (
    <LoadingRegion label="Loading consumption standards…" className="mx-auto w-full max-w-5xl">
      <PageHeaderSkeleton />
      <div className="mt-7 space-y-4">
        <DataCardSkeleton body="tiles" action />
        <DataCardSkeleton rows={6} columns={5} action />
      </div>
    </LoadingRegion>
  );
}
