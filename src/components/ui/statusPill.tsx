import type { LucideIcon } from "lucide-react";

type StatusPillProps = {
  label: string;
  icon: LucideIcon;
  className: string;
};

/**
 * Status colour never carries meaning alone — every pill ships an icon and a label.
 */
export default function StatusPill({
  label,
  icon: Icon,
  className,
}: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
