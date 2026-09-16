import { DataCardSkeleton, LoadingRegion, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function OperatorsLoading() {
  return (
    <LoadingRegion label="Loading operators…" className="mx-auto w-full max-w-5xl">
      <PageHeaderSkeleton action />
      <div className="mt-7">
        <DataCardSkeleton rows={5} columns={5} />
      </div>
    </LoadingRegion>
  );
}
