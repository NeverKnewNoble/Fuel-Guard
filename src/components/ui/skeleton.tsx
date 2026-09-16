import type { ReactNode } from "react";

/**
 * Loading placeholders shaped like the real components, so the page doesn't
 * jump when data arrives. Pulses only when the user allows motion.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded-md bg-slate-200/70 motion-safe:animate-pulse ${className}`} />;
}

/** Root of a `loading.tsx`: announces the wait to screen readers once, instead of per placeholder. */
export function LoadingRegion({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Matches `PageHeader`. */
export function PageHeaderSkeleton({ action = false, actions = action ? 1 : 0 }: { action?: boolean; actions?: number }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="w-full max-w-2xl">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-8 w-64 max-w-full sm:h-9" />
        <Skeleton className="mt-3 h-4 w-full max-w-md" />
      </div>
      {actions > 0 && (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl sm:w-36" />
          ))}
        </div>
      )}
    </div>
  );
}

/** Matches `StatTile` / `AnimatedStatTile`. Pass the same grid classes the page uses. */
export function StatTilesSkeleton({ count, className }: { count: number; className: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

type CardBody = "table" | "list" | "chart" | "tiles";

/** Matches `DataCard`, with a body shaped like what the card normally holds. */
export function DataCardSkeleton({
  body = "table",
  rows = 5,
  columns = 5,
  action = false,
}: {
  body?: CardBody;
  rows?: number;
  /** Table columns on large screens. */
  columns?: number;
  action?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3.5 w-full max-w-xs" />
        </div>
        {action && <Skeleton className="h-9 w-28 rounded-lg" />}
      </header>
      {body === "table" && <TableBody rows={rows} columns={columns} />}
      {body === "list" && <ListBody rows={rows} />}
      {body === "chart" && <ChartBody />}
      {body === "tiles" && <TilesBody />}
    </section>
  );
}

/** Just the body of a `DataCardSkeleton`, for a real `DataCard` whose query is still loading. */
export function DataCardBodySkeleton({
  body = "table",
  rows = 5,
  columns = 5,
  label = "Loading…",
}: {
  body?: CardBody;
  rows?: number;
  columns?: number;
  label?: string;
}) {
  return (
    <LoadingRegion label={label}>
      {body === "table" && <TableBody rows={rows} columns={columns} />}
      {body === "list" && <ListBody rows={rows} />}
      {body === "chart" && <ChartBody />}
      {body === "tiles" && <TilesBody />}
    </LoadingRegion>
  );
}

function TableBody({ rows, columns }: { rows: number; columns: number }) {
  return (
    <>
      {/* Small screens: card rows, like MobileList */}
      <ul className="divide-y divide-slate-100 lg:hidden">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3.5 w-24" />
              </div>
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {Array.from({ length: Math.min(columns - 1, 3) }, (_, j) => (
                <div key={j}>
                  <Skeleton className="h-2.5 w-14" />
                  <Skeleton className="mt-1.5 h-4 w-20" />
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {/* Large screens: table rows */}
      <div className="hidden lg:block">
        <div className="flex items-center gap-6 border-b border-slate-100 bg-slate-50/60 px-6 py-3">
          <Skeleton className="h-4 w-4 rounded" />
          {Array.from({ length: columns }, (_, j) => (
            <Skeleton key={j} className="h-2.5 flex-1" />
          ))}
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-6 px-6 py-4">
              <Skeleton className="h-4 w-4 rounded" />
              {Array.from({ length: columns }, (_, j) => (
                // Vary widths so the rows don't read as a solid block.
                <div key={j} className="flex-1">
                  <Skeleton className={`h-4 ${j === 0 ? "w-3/4" : (i + j) % 3 === 0 ? "w-1/2" : "w-2/3"}`} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ListBody({ rows }: { rows: number }) {
  return (
    <ul className="divide-y divide-slate-100">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <Skeleton className={`h-4 ${i % 2 === 0 ? "w-40" : "w-32"} max-w-full`} />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

const BAR_HEIGHTS = ["h-24", "h-36", "h-28", "h-44", "h-32", "h-40", "h-20", "h-36", "h-48", "h-28", "h-32"];

function ChartBody() {
  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="flex justify-end">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="mt-2 flex h-60 items-end gap-2 border-b border-l border-slate-100 pb-px pl-px">
        {BAR_HEIGHTS.map((height, i) => (
          <Skeleton key={i} className={`${height} flex-1 rounded-b-none`} />
        ))}
      </div>
    </div>
  );
}

function TilesBody() {
  return (
    <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3 sm:px-6">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Matches the Tankers page's "Fuel tankers" row of `TankCard`s. */
export function TankCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-52" />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-1.5 h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-7 w-28" />
            <Skeleton className="mt-3 h-2 w-full rounded-full" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
