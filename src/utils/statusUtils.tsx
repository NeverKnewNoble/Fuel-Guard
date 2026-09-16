import {
  Archive,
  CircleCheck,
  CircleSlash,
  Eye,
  MailPlus,
  ShieldAlert,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { AccountStatus } from "@/types/account";
import type { AlertSeverity, AlertState } from "@/types/alerts";
import type { EquipmentRecordStatus } from "@/types/equipment";
import type { VarianceStatus } from "@/types/monthly";
import type { AppUserRole } from "@/types/next-auth";
import type { ThresholdLevel } from "@/types/standards";

export type PillStyle = { label: string; icon: LucideIcon; className: string };

/** Role badges on Users & Roles. */
export const roleStyles: Record<AppUserRole, string> = {
  administrator: "border-brand-200 bg-brand-50 text-brand-700",
  records_taker: "border-sky-200 bg-sky-50 text-sky-700",
};

export const equipmentStatusStyles: Record<EquipmentRecordStatus, PillStyle> = {
  retired: {
    label: "Retired",
    icon: Archive,
    className: "border-slate-200 bg-slate-50 text-slate-500",
  },
  active: {
    label: "Active",
    icon: CircleCheck,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    className: "border-brand-200 bg-brand-50 text-brand-700",
  },
  idle: {
    label: "Idle",
    icon: CircleSlash,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
};

export const varianceStatusStyles: Record<VarianceStatus, PillStyle> = {
  normal: {
    label: "Normal",
    icon: CircleCheck,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  watch: {
    label: "Watch",
    icon: Eye,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  high: {
    label: "High",
    icon: TriangleAlert,
    className: "border-brand-200 bg-brand-50 text-brand-700",
  },
  critical: {
    label: "Critical",
    icon: ShieldAlert,
    className: "border-brand-300 bg-brand-100 text-brand-800",
  },
};

export const alertSeverityStyles: Record<AlertSeverity, PillStyle> = {
  critical: {
    label: "Critical",
    icon: ShieldAlert,
    className: "border-brand-300 bg-brand-100 text-brand-800",
  },
  high: {
    label: "High",
    icon: TriangleAlert,
    className: "border-brand-200 bg-brand-50 text-brand-700",
  },
  watch: {
    label: "Watch",
    icon: Eye,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
};

export const alertStateStyles: Record<AlertState, PillStyle> = {
  open: {
    label: "Open",
    icon: TriangleAlert,
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  reviewing: {
    label: "Reviewing",
    icon: Eye,
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  resolved: {
    label: "Resolved",
    icon: CircleCheck,
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

export const accountStatusStyles: Record<AccountStatus, PillStyle> = {
  active: {
    label: "Active",
    icon: CircleCheck,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  invited: {
    label: "Invited",
    icon: MailPlus,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  disabled: {
    label: "Disabled",
    icon: CircleSlash,
    className: "border-slate-200 bg-slate-50 text-slate-500",
  },
};

export const thresholdStyles: Record<
  ThresholdLevel,
  { className: string; valueClassName: string }
> = {
  watch: {
    className: "border-amber-200 bg-amber-50",
    valueClassName: "text-amber-700",
  },
  high: {
    className: "border-brand-200 bg-brand-50",
    valueClassName: "text-brand-700",
  },
  critical: {
    className: "border-brand-300 bg-brand-100",
    valueClassName: "text-brand-800",
  },
};

/** Signed variance, e.g. +9.0% / -2.5% / — */
export function formatVariance(value: number | null) {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** Over standard reads as a problem; at or under standard does not. */
export function varianceToneClass(value: number | null) {
  if (value === null) return "text-slate-400";
  if (value >= 15) return "text-brand-700";
  if (value >= 5) return "text-amber-700";
  return "text-slate-600";
}

export const dash = (value: number | null, digits = 0) =>
  value === null ? "—" : value.toFixed(digits);
