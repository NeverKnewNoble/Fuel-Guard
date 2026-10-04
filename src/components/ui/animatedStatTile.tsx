"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Counts from 0 to `target` on mount, easing out so it settles rather than stops. */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const frame = useRef<number>(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return value;
}

export default function AnimatedStatTile({
  label,
  value,
  hint,
  icon,
  prefix = "",
  suffix = "",
  delay = 0,
  href,
}: {
  label: string;
  value: number;
  hint?: string;
  /** A rendered element, not a component: functions can't cross the RSC boundary. */
  icon: ReactNode;
  prefix?: string;
  suffix?: string;
  /** Stagger index in ms so the row resolves left to right. */
  delay?: number;
  /** Makes the whole tile a link to the page behind the figure. */
  href?: string;
}) {
  const current = useCountUp(value);
  const className =
    "rounded-2xl border border-slate-200 bg-surface p-4 opacity-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
  const style = { animation: `riseIn 420ms cubic-bezier(0.16,1,0.3,1) ${delay}ms forwards` };

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-500">{label}</p>
        {icon}
      </div>
      <p className="mt-2 wrap-break-word text-xl font-semibold sm:text-2xl text-slate-900">
        {prefix}
        {Math.round(current).toLocaleString()}
        {suffix}
      </p>
      {hint && (
        <p className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-400">
          {hint}
          {href && (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
          )}
        </p>
      )}
    </>
  );

  if (!href) {
    return (
      <div className={className} style={style}>
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`group block transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 ${className}`}
      style={style}
    >
      {body}
    </Link>
  );
}
