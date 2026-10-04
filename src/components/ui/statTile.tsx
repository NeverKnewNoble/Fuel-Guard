import type { LucideIcon } from "lucide-react";

type StatTileProps = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  /** Tailwind text colour for the icon — use an accent only when the tile needs attention. */
  accent?: string;
};

export default function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent = "text-slate-400",
}: StatTileProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-500">{label}</p>
        <Icon className={`h-4 w-4 shrink-0 ${accent}`} aria-hidden />
      </div>
      {/* Proportional figures: tabular-nums makes a standalone value read loose */}
      <p className="mt-2 wrap-break-word text-xl font-semibold sm:text-2xl text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
