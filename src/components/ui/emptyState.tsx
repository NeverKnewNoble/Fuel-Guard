import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Usually the button that creates the first record. */
  action?: ReactNode;
  /** `sm` for tight spots like a dashboard list or a chart; `md` for a full table. */
  size?: "sm" | "md";
  /** Draws a dashed outline, for empty areas that sit outside a card. */
  bordered?: boolean;
};

/** Shown in place of a list, table or chart that has nothing to display yet. */
export default function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  size = "md",
  bordered = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-5 text-center sm:px-6 ${
        size === "sm" ? "py-8" : "py-12"
      } ${bordered ? "rounded-2xl border border-dashed border-slate-300 bg-white" : ""}`}
    >
      <span
        className={`flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 ${
          size === "sm" ? "h-10 w-10" : "h-12 w-12"
        }`}
      >
        <Icon className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
