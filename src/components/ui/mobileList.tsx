import type { ReactNode } from "react";

/**
 * Card-style stand-ins for table rows on small screens. Pages render the table
 * from `lg` up and one of these lists below it, so nothing scrolls sideways.
 */
export function MobileList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-slate-100 lg:hidden">{children}</ul>;
}

/** Title block for a mobile record: checkbox, name/ID, and a trailing slot for status or actions. */
export function MobileRecordHeader({
  select,
  title,
  subtitle,
  trailing,
}: {
  select?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      {select && <div className="pt-0.5">{select}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</div>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-1">{trailing}</div>}
    </div>
  );
}

export function MobileFields({ children }: { children: ReactNode }) {
  return <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">{children}</dl>;
}

export function MobileField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-slate-700">{children}</dd>
    </div>
  );
}
