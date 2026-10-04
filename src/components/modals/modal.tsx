"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Rendered at the top-right of the header, e.g. a status pill. */
  badge?: ReactNode;
  /** Buttons pinned to the bottom of the panel. */
  footer?: ReactNode;
  size?: "md" | "lg";
  children: ReactNode;
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  badge,
  footer,
  size = "md",
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    restoreFocus.current = document.activeElement as HTMLElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Prefer the first form field; the close button sits earlier in DOM order.
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>(
      "input:not([readonly]):not([type=checkbox]), select, textarea"
    );
    (firstField ?? panel?.querySelector<HTMLElement>("button"))?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      // Keep Tab inside the dialog.
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      restoreFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
      {/* Blurred, dimmed backdrop */}
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl animate-[modalIn_180ms_cubic-bezier(0.16,1,0.3,1)] ${
          size === "lg" ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div>
            <h2 id={titleId} className="text-xl font-semibold text-slate-900">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {badge}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 sm:px-6">{children}</div>

        {footer && (
          <footer className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
