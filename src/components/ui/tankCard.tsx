"use client";

import { Fuel } from "lucide-react";

import { TankRowActions } from "@/components/tankers/tankRowActions";
import type { TankCardData } from "@/types/tank";
import { formatShortDateTime } from "@/utils/formatDate";
import { tankLevelStyles } from "@/utils/tankUtils";

export default function TankCard({ tank }: { tank: TankCardData }) {
  const pct = tank.fillPct;
  const style = tankLevelStyles[tank.level];
  const LevelIcon = style.icon;
  const neverDipped = tank.measuredAt === null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <Fuel className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">
              {tank.name}
            </span>
            <span className="block truncate text-xs text-slate-500">
              {tank.siteName}
            </span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${style.pill}`}
          >
            <LevelIcon className="h-3 w-3 shrink-0" aria-hidden />
            {style.label}
          </span>
          <TankRowActions
            tank={{ id: tank.id, code: tank.code, name: tank.name, capacityL: tank.capacityL, currentL: tank.currentL }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        {/* Proportional figures — a standalone value reads loose with tabular-nums */}
        <span className="text-2xl font-semibold text-slate-900">
          {tank.currentL.toLocaleString()}
        </span>
        <span className="text-sm text-slate-500">
          / {tank.capacityL.toLocaleString()} L
        </span>
        <span className="ml-auto text-sm font-medium text-slate-600">
          {Math.round(pct)}%
        </span>
      </div>

      {/* Meter: severity in the fill, a lighter step of the same ramp as the track */}
      <div
        className={`mt-2 h-2 w-full overflow-hidden rounded-full ${style.track}`}
        role="meter"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${tank.name} fuel level`}
      >
        <div
          className={`h-full rounded-full ${style.fill}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* The level counts deliveries and fills since the last dip, so say when it was last measured for real. */}
      <p className="mt-3 text-xs text-slate-400">
        <span className="font-mono">{tank.code}</span> ·{" "}
        {neverDipped ? (
          <span className="font-medium text-amber-700">never dipped</span>
        ) : (
          <>
            dipped <span className="font-mono tabular-nums">{formatShortDateTime(tank.measuredAt)}</span>
            {typeof tank.measuredL === "number" && <> at {tank.measuredL.toLocaleString()} L</>}
          </>
        )}
        {/* Falsy covers 0 (level is as measured) and a cached row from before these fields existed. */}
        {Boolean(tank.sinceDipL) && (
          <span className={tank.sinceDipL > 0 ? " text-emerald-700" : " text-amber-700"}>
            {" "}
            · {tank.sinceDipL > 0 ? "+" : "−"}
            {Math.abs(tank.sinceDipL).toLocaleString()} L since
          </span>
        )}
      </p>
      <p className="mt-0.5 text-xs text-slate-400">
        Last refill <span className="font-mono tabular-nums">{formatShortDateTime(tank.lastRefillAt, "none yet")}</span>
      </p>
    </div>
  );
}
