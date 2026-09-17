"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

/**
 * The "view details" pattern: a row shows only what you scan by — who, what, how much — and
 * everything else waits behind a chevron. Keeps tables down to a handful of columns instead of a
 * dozen columns of small print.
 *
 *   const details = useDisclosure();
 *   <ExpandButton {...details.buttonProps} label={`details for ${row.code}`} />
 *   {details.open && <DetailPanel id={details.panelId}> … </DetailPanel>}
 */
export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  const panelId = useId();
  return {
    open,
    panelId,
    toggle: () => setOpen((v) => !v),
    buttonProps: { expanded: open, onToggle: () => setOpen((v) => !v), controls: panelId },
  };
}

export function ExpandButton({
  expanded,
  onToggle,
  controls,
  label,
  /** "text" puts the words "View details" next to the chevron — for cards, where there's room. */
  variant = "icon",
}: {
  expanded: boolean;
  onToggle: () => void;
  controls: string;
  /** What's being expanded, e.g. "details for LOG-0001" — read out after "Hide"/"Show". */
  label: string;
  variant?: "icon" | "text";
}) {
  // Brand red with a white arrow: at one per row it has to read as the thing to press, not as decoration.
  const chevron = (
    <ChevronDown
      className={`h-4 w-4 shrink-0 text-white transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
      aria-hidden
    />
  );
  const focus = "focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2";

  if (variant === "text") {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={controls}
        className={`inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-500 ${focus}`}
      >
        {expanded ? "Hide details" : "View details"}
        {chevron}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controls}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 shadow-sm transition-colors hover:bg-brand-500 ${focus}`}
    >
      <span className="sr-only">{expanded ? `Hide ${label}` : `Show ${label}`}</span>
      {chevron}
    </button>
  );
}

/** The revealed panel: a quiet surface so it reads as part of the row it belongs to. */
export function DetailPanel({
  id,
  children,
  /** Set inside a table whose rows already draw their own divider, so the line isn't doubled. */
  flush = false,
  /** One column for narrow containers like a card; "auto" spreads the groups across the width. */
  columns = "auto",
  className = "",
}: {
  id: string;
  children: ReactNode;
  flush?: boolean;
  columns?: "auto" | 1;
  className?: string;
}) {
  return (
    <div
      id={id}
      className={`bg-slate-50/60 px-5 py-4 sm:px-6 ${flush ? "" : "border-t border-slate-100"} ${className}`}
    >
      <div className={`grid gap-x-10 gap-y-1 ${columns === 1 ? "" : "sm:grid-cols-2 xl:grid-cols-3"}`}>{children}</div>
    </div>
  );
}

/** One labelled group inside a panel, e.g. the meter readings. */
export function DetailGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <dl className="min-w-0">
      {title && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>}
      {children}
    </dl>
  );
}

/** Label left, value right — the shape the reference screens use, at a size you can actually read. */
export function DetailItem({
  label,
  children,
  emphasis = false,
}: {
  label: string;
  children: ReactNode;
  /** Set on the line that matters most in the group, e.g. the consumption figure. */
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-sm text-slate-500">{label}</dt>
      {/* Wraps rather than truncates: a long location or note is the reason someone opened the panel. */}
      <dd className={`min-w-0 break-words text-right text-sm tabular-nums ${emphasis ? "font-semibold text-slate-900" : "text-slate-700"}`}>
        {children}
      </dd>
    </div>
  );
}
