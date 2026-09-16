import { DataCardSkeleton, LoadingRegion, PageHeaderSkeleton, TankCardsSkeleton } from "@/components/ui/skeleton";

export default function TankersLoading() {
  return (
    <LoadingRegion label="Loading tankers…" className="mx-auto w-full max-w-6xl">
      <PageHeaderSkeleton actions={2} />
      <div className="mt-7">
        <TankCardsSkeleton count={4} />
      </div>
      <div className="mt-6 space-y-4">
        <DataCardSkeleton rows={4} columns={8} />
        <DataCardSkeleton rows={5} columns={8} />
      </div>
    </LoadingRegion>
  );
}
