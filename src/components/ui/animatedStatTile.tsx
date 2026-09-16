"use client";

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
}) {
  const current = useCountUp(value);

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-4 opacity-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      style={{
        animation: `riseIn 420ms cubic-bezier(0.16,1,0.3,1) ${delay}ms forwards`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-500">{label}</p>
        {icon}
      </div>
      <p className="mt-2 wrap-break-word text-xl font-semibold sm:text-2xl text-slate-900">
        {prefix}
        {Math.round(current).toLocaleString()}
        {suffix}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
