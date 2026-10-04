"use client";

import { MoreHorizontal, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

export type RowActionItem = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** Red text, for destructive or hard-to-undo actions. */
  tone?: "danger";
  /** Skipped when true, so callers can build the list inline. */
  hidden?: boolean;
  /** Draws a divider above this item. */
  separated?: boolean;
};

type RowActionsProps = {
  /** Names the record so the trigger and menu are distinguishable to screen readers. */
  label: string;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Custom menu items. When given, they replace the default Edit / Delete pair. */
  items?: RowActionItem[];
};

export default function RowActions({ label, onEdit, onDelete, items }: RowActionsProps) {
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const open = position !== null;
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const menuItems: RowActionItem[] = (
    items ?? [
      { label: "Edit", icon: Pencil, onSelect: () => onEdit?.() },
      { label: "Delete", icon: Trash2, onSelect: () => onDelete?.(), tone: "danger" },
    ]
  ).filter((item) => !item.hidden);

  /**
   * The menu is `position: fixed` against the viewport, so a table's or scroller's `overflow`
   * can't clip it. It opens upwards when there isn't room below.
   */
  function toggle() {
    if (open || !buttonRef.current) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const estimatedHeight = menuItems.length * 40 + 8;
    const right = window.innerWidth - rect.right;
    setPosition(
      rect.bottom + 4 + estimatedHeight > window.innerHeight && rect.top > estimatedHeight
        ? { right, bottom: window.innerHeight - rect.top + 4 }
        : { right, top: rect.bottom + 4 }
    );
  }

  useEffect(() => {
    if (!open) return;

    const close = () => setPosition(null);
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // A fixed menu would drift away from its button, so close it instead.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
        className={`inline-flex h-9 w-9 items-center lg:h-8 lg:w-8 justify-center rounded-lg border transition-colors ${
          open
            ? "border-slate-300 bg-slate-100 text-slate-700"
            : "border-transparent text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"
        }`}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={`Actions for ${label}`}
          style={position}
          className={`fixed z-40 overflow-hidden rounded-xl border border-slate-200 bg-surface py-1 shadow-lg ${
            items ? "w-48" : "w-36"
          }`}
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            const danger = item.tone === "danger";
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPosition(null);
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm lg:py-2 transition-colors ${
                  danger ? "text-brand-700 hover:bg-brand-50" : "text-slate-700 hover:bg-slate-50"
                } ${item.separated ? "border-t border-slate-100" : ""}`}
              >
                <Icon className={`h-3.5 w-3.5 ${danger ? "text-brand-500" : "text-slate-400"}`} aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
