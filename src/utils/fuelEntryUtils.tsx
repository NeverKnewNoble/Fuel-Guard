import { Eye, Lock, TriangleAlert, type LucideIcon } from "lucide-react";

import type { EntryStatus } from "@/types/fuelLog";

type StatusStyle = {
  label: string;
  /** Short form for dense layouts (table cells, mobile). */
  shortLabel: string;
  /** Status colour never carries meaning alone — every state ships an icon. */
  icon: LucideIcon;
  className: string;
  dotClassName: string;
  /** Left rail accent on the row, used to draw the eye to states needing action. */
  railClassName: string;
};

export const statusStyles: Record<EntryStatus, StatusStyle> = {
  locked: {
    label: "Submitted — locked",
    shortLabel: "Locked",
    icon: Lock,
    className: "border-slate-200 bg-slate-50 text-slate-600",
    dotClassName: "bg-slate-400",
    railClassName: "bg-transparent",
  },
  flagged: {
    label: "Flagged",
    shortLabel: "Flagged",
    icon: TriangleAlert,
    className: "border-brand-200 bg-brand-50 text-brand-700",
    dotClassName: "bg-brand-500",
    railClassName: "bg-brand-500",
  },
  watch: {
    label: "Watch",
    shortLabel: "Watch",
    icon: Eye,
    className: "border-amber-200 bg-amber-50 text-amber-700",
    dotClassName: "bg-amber-500",
    railClassName: "bg-amber-400",
  },
};

/** Initials for the avatar chip, e.g. "Kwame Asante" -> "KA". */
export function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
