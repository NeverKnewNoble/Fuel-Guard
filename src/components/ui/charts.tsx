"use client";

import { BarChart3, TrendingUp, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import EmptyState from "@/components/ui/emptyState";
import type { ConsumptionComparison, DailyIssuancePoint } from "@/types/dashboard";

/**
 * Categorical slots 1 and 2 of the validated palette.
 * Verified with the palette validator on the light surface:
 * CVD ΔE 24.7 (protan) / 32.7 (tritan), normal-vision ΔE 33.6, both ≥ 3:1 contrast.
 */
const SERIES_ACTUAL = "#2a78d6";
const SERIES_STANDARD = "#eb6834";

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span
        aria-hidden
        className="h-2.5 w-2.5 rounded-[3px]"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

/**
 * Tracks the rendered width so the viewBox matches real pixels — text stays
 * legible on phones instead of shrinking with a scaled-down SVG.
 */
function useChartWidth(fallback = 560) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

/** Same height as a chart plus its legend, so the card doesn't resize when data arrives. */
function ChartEmpty({ icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex min-h-[16.5rem] items-center justify-center">
      <EmptyState size="sm" icon={icon} title={title} description={description} />
    </div>
  );
}

function truncateLabel(label: string, maxChars: number) {
  return label.length <= maxChars ? label : `${label.slice(0, Math.max(1, maxChars - 1))}…`;
}

/* ------------------------- Daily issuance (area) -------------------------- */

export function DailyIssuanceChart({ data }: { data: DailyIssuancePoint[] }) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [wrapRef, W] = useChartWidth();

  if (data.every((d) => d.litres === 0)) {
    return (
      <ChartEmpty
        icon={TrendingUp}
        title="No fuel issued in this period"
        description="The chart fills in as fuel entries are recorded."
      />
    );
  }

  const H = 240;
  const PAD = { top: 16, right: 26, bottom: 28, left: 44 };
  // Thin out date labels when there isn't room for every one.
  const labelEvery = W < 480 ? 2 : 1;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = Math.ceil(Math.max(...data.map((d) => d.litres)) / 500) * 500;
  // A single day sits at the left edge instead of dividing by zero.
  const x = (i: number) => PAD.left + (i / Math.max(1, data.length - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.litres)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${PAD.top + plotH} L${x(0)},${PAD.top + plotH} Z`;
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];

  return (
    <figure className="m-0">
      <div className="flex items-center justify-end">
        <LegendSwatch color={SERIES_ACTUAL} label="Litres issued" />
      </div>
      <div ref={wrapRef} className="mt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-60 w-full"
          role="img"
          aria-label="Daily fuel issued in litres over the last 11 days"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_ACTUAL} stopOpacity="0.22" />
              <stop offset="100%" stopColor={SERIES_ACTUAL} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Recessive grid + axis labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="stroke-slate-200"
                strokeWidth="1"
                strokeDasharray={t === 0 ? undefined : "3 3"}
              />
              <text
                x={PAD.left - 8}
                y={y(t) + 4}
                textAnchor="end"
                className="fill-slate-400 text-[10px]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {t.toLocaleString()}
              </text>
            </g>
          ))}

          <path
            d={area}
            fill={`url(#${gradientId})`}
            className="opacity-0"
            style={{ animation: "fadeIn 700ms ease-out 500ms forwards" }}
          />
          <path
            d={line}
            fill="none"
            stroke={SERIES_ACTUAL}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            style={{
              // pathLength normalises the dash to 1 regardless of real length
              ["--dash" as string]: "1",
              strokeDasharray: 1,
              strokeDashoffset: 1,
              animation: "drawLine 900ms cubic-bezier(0.4,0,0.2,1) forwards",
            }}
          />

          {data.map((d, i) => (
            <g key={d.date}>
              {i % labelEvery === 0 && (
                <text
                  x={x(i)}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px]"
                >
                  {d.date}
                </text>
              )}
              {hover === i && (
                <line
                  x1={x(i)}
                  x2={x(i)}
                  y1={PAD.top}
                  y2={PAD.top + plotH}
                  className="stroke-slate-400"
                  strokeWidth="1"
                />
              )}
              <circle
                cx={x(i)}
                cy={y(d.litres)}
                r={hover === i ? 5 : 0}
                fill={SERIES_ACTUAL}
                className="stroke-surface"
                strokeWidth="2"
              />
              {/* Hit target, wider than the mark */}
              <rect
                x={x(i) - plotW / (data.length * 2)}
                y={PAD.top}
                width={plotW / data.length}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(i)}
              />
            </g>
          ))}

          {hover !== null && (
            <g transform={`translate(${Math.min(Math.max(x(hover), 60), W - 70)}, ${PAD.top + 6})`}>
              <rect x="-56" y="-2" width="112" height="34" rx="8" fill="#0f172a" opacity="0.92" />
              <text x="0" y="11" textAnchor="middle" className="fill-white text-[10px]">
                {data[hover].date}
              </text>
              <text x="0" y="25" textAnchor="middle" className="fill-white text-[11px] font-semibold">
                {data[hover].litres.toLocaleString()} L
              </text>
            </g>
          )}
        </svg>
      </div>
    </figure>
  );
}

/* --------------------- Consumption vs standard (bars) --------------------- */

export function ConsumptionChart({ data }: { data: ConsumptionComparison[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const [wrapRef, W] = useChartWidth();

  if (data.length === 0) {
    return (
      <ChartEmpty
        icon={BarChart3}
        title="No consumption to compare yet"
        description="Hour-metered units appear here once they have fuel entries this month."
      />
    );
  }

  const H = 240;
  const PAD = { top: 16, right: 16, bottom: 40, left: 34 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = Math.max(6, Math.ceil(Math.max(...data.flatMap((d) => [d.actual, d.standard])) / 6) * 6);
  const groupW = plotW / data.length;
  const barW = (groupW - 14) / 2;
  // ~5.5px per character at 10px; keep a little air between neighbours.
  const labelChars = Math.floor((groupW - 4) / 5.5);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];

  return (
    <figure className="m-0">
      <div className="flex items-center justify-end gap-4">
        <LegendSwatch color={SERIES_ACTUAL} label="Actual" />
        <LegendSwatch color={SERIES_STANDARD} label="Standard" />
      </div>
      <div ref={wrapRef} className="mt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-60 w-full"
          role="img"
          aria-label="Actual versus standard litres per hour by equipment"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="stroke-slate-200"
                strokeWidth="1"
                strokeDasharray={t === 0 ? undefined : "3 3"}
              />
              <text
                x={PAD.left - 8}
                y={y(t) + 4}
                textAnchor="end"
                className="fill-slate-400 text-[10px]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {t}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const gx = PAD.left + i * groupW;
            const isHover = hover === d.equipment;
            return (
              <g
                key={d.equipment}
                onMouseEnter={() => setHover(d.equipment)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(d.equipment)}
              >
                <rect
                  x={gx}
                  y={PAD.top}
                  width={groupW}
                  height={plotH}
                  className={isHover ? "fill-slate-100" : "fill-transparent"}
                />
                {/* 2px surface gap between adjacent bars */}
                <rect
                  x={gx + 5}
                  y={y(d.actual)}
                  width={barW}
                  height={PAD.top + plotH - y(d.actual)}
                  rx="4"
                  fill={SERIES_ACTUAL}
                  style={{
                    transformOrigin: `0 ${PAD.top + plotH}px`,
                    animation: `growUp 620ms cubic-bezier(0.16,1,0.3,1) ${i * 70}ms both`,
                  }}
                />
                <rect
                  x={gx + 7 + barW}
                  y={y(d.standard)}
                  width={barW}
                  height={PAD.top + plotH - y(d.standard)}
                  rx="4"
                  fill={SERIES_STANDARD}
                  style={{
                    transformOrigin: `0 ${PAD.top + plotH}px`,
                    animation: `growUp 620ms cubic-bezier(0.16,1,0.3,1) ${i * 70 + 35}ms both`,
                  }}
                />
                <text
                  x={gx + groupW / 2}
                  y={H - 22}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px]"
                >
                  <title>{d.equipment}</title>
                  {truncateLabel(d.equipment, labelChars)}
                </text>
                {isHover && (
                  <text
                    x={Math.min(Math.max(gx + groupW / 2, PAD.left + 40), W - 44)}
                    y={H - 8}
                    textAnchor="middle"
                    className="fill-slate-600 text-[10px] font-medium"
                  >
                    {d.actual} vs {d.standard} L/hr
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}
