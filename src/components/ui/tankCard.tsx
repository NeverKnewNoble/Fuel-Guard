"use client";

import { Fuel } from "lucide-react";

import { TankRowActions } from "@/components/tankers/tankRowActions";
import {
  DetailGroup,
  DetailItem,
  DetailPanel,
  ExpandButton,
  useDisclosure,
} from "@/components/ui/detailDisclosure";
import type { TankCardData } from "@/types/tank";
import { formatShortDateTime } from "@/utils/formatDate";
import { tankLevelStyles } from "@/utils/tankUtils";

export default function TankCard({ tank }: { tank: TankCardData }) {
  const details = useDisclosure();
  const pct = tank.fillPct;
  const style = tankLevelStyles[tank.level];
  const LevelIcon = style.icon;
  const neverDipped = tank.measuredAt === null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
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
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${style.pill}`}
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

      {/* The dip history used to be two lines of fine print here; it lives behind the button now. */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-slate-500">
          {tank.code}
          {neverDipped && <span className="ml-2 font-medium text-amber-700">never dipped</span>}
        </span>
        <ExpandButton {...details.buttonProps} label={`details for ${tank.name}`} variant="text" />
      </div>

      {details.open && (
        <DetailPanel id={details.panelId} columns={1} className="-mx-4 -mb-4 mt-3 rounded-b-2xl">
          <DetailGroup title="Stock">
            <DetailItem label="Current level" emphasis>
              {tank.currentL.toLocaleString()} L
            </DetailItem>
            <DetailItem label="Capacity">{tank.capacityL.toLocaleString()} L</DetailItem>
            <DetailItem label="Filled">{Math.round(pct)}%</DetailItem>
          </DetailGroup>

          <DetailGroup title="Last dip">
            <DetailItem label="Measured at">
              {neverDipped ? <span className="text-amber-700">Never dipped</span> : formatShortDateTime(tank.measuredAt)}
            </DetailItem>
            {typeof tank.measuredL === "number" && (
              <DetailItem label="Measured level">{tank.measuredL.toLocaleString()} L</DetailItem>
            )}
            {/* Falsy covers 0 (level is as measured) and a cached row from before these fields existed. */}
            {Boolean(tank.sinceDipL) && (
              <DetailItem label="Movement since">
                <span className={tank.sinceDipL > 0 ? "text-emerald-700" : "text-amber-700"}>
                  {tank.sinceDipL > 0 ? "+" : "−"}
                  {Math.abs(tank.sinceDipL).toLocaleString()} L
                </span>
              </DetailItem>
            )}
            <DetailItem label="Last refill">{formatShortDateTime(tank.lastRefillAt, "None yet")}</DetailItem>
          </DetailGroup>

          <DetailGroup title="Tanker">
            <DetailItem label="Code">{tank.code}</DetailItem>
            <DetailItem label="Site">{tank.siteName}</DetailItem>
          </DetailGroup>
        </DetailPanel>
      )}
    </div>
  );
}
