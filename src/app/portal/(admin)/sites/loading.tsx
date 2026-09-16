import { DataCardSkeleton, LoadingRegion, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function SitesLoading() {
  return (
    <LoadingRegion label="Loading sites…" className="mx-auto w-full max-w-5xl">
      <PageHeaderSkeleton action />
      <div className="mt-7">
        <DataCardSkeleton rows={4} columns={5} />
      </div>
    </LoadingRegion>
  );
}
