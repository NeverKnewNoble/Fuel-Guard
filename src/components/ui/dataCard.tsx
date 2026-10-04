import type { ReactNode } from "react";

type DataCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  /** Drop the default padding when the body is a full-bleed table or list. */
  flush?: boolean;
  /**
   * Rendered instead of `children` when set: an empty, loading or error state,
   * e.g. `rows.length === 0 && <EmptyState … />`. It brings its own padding, so it
   * looks the same in flush and padded cards.
   */
  emptyState?: ReactNode;
};

export default function DataCard({
  title,
  description,
  action,
  children,
  flush = false,
  emptyState,
}: DataCardProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}
        </div>
        {action}
      </header>
      {emptyState ? emptyState : <div className={flush ? "" : "px-5 py-4 sm:px-6"}>{children}</div>}
    </section>
  );
}
