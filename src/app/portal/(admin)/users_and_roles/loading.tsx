import { DataCardSkeleton, LoadingRegion, PageHeaderSkeleton, StatTilesSkeleton } from "@/components/ui/skeleton";

export default function UsersAndRolesLoading() {
  return (
    <LoadingRegion label="Loading users…" className="mx-auto w-full max-w-6xl">
      <PageHeaderSkeleton action />
      <StatTilesSkeleton count={3} className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3" />
      <div className="mt-4">
        <DataCardSkeleton rows={6} columns={6} />
      </div>
    </LoadingRegion>
  );
}
