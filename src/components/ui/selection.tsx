"use client";

import { Download, Trash2, X } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type SelectionValue = {
  ids: string[];
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionValue | null>(null);

function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) {
    throw new Error("Selection components must be used inside <SelectionProvider>");
  }
  return ctx;
}

/**
 * Holds selection state for one list. Children are rendered as-is, so the table
 * itself can stay a server component — only the checkboxes and bar are client.
 */
export function SelectionProvider({
  ids,
  children,
}: {
  ids: string[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const value = useMemo<SelectionValue>(
    () => ({
      ids,
      selected,
      toggle: (id) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      toggleAll: () =>
        setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids))),
      clear: () => setSelected(new Set()),
    }),
    [ids, selected]
  );

  return (
    <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
  );
}

const boxClass =
  "h-5 w-5 shrink-0 lg:h-4 lg:w-4 cursor-pointer rounded border-slate-300 text-brand-600 accent-brand-600 focus:ring-2 focus:ring-brand-500/50";

export function SelectAllCheckbox({ label = "rows" }: { label?: string }) {
  const { ids, selected, toggleAll } = useSelection();
  const ref = useRef<HTMLInputElement>(null);
  const all = ids.length > 0 && selected.size === ids.length;
  const some = selected.size > 0 && !all;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={all}
      onChange={toggleAll}
      aria-label={all ? `Deselect all ${label}` : `Select all ${label}`}
      className={boxClass}
    />
  );
}

/** "Select all" strip for card lists, which have no header row to hold the checkbox. */
export function SelectAllBar({ label = "rows" }: { label?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 sm:px-6 lg:hidden">
      <SelectAllCheckbox label={label} />
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Select all
      </span>
    </label>
  );
}

export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label={`Select ${label}`}
      className={boxClass}
    />
  );
}

/** Renders a <tr> or <li> that highlights while its record is selected. */
export function SelectableRow({
  id,
  as = "tr",
  className = "",
  selectedClassName = "bg-brand-50/40",
  children,
}: {
  id: string;
  as?: "tr" | "li";
  className?: string;
  selectedClassName?: string;
  children: ReactNode;
}) {
  const { selected } = useSelection();
  const isSelected = selected.has(id);
  const cls = `${className} ${isSelected ? selectedClassName : ""}`;

  if (as === "li") {
    return (
      <li className={cls} data-selected={isSelected || undefined}>
        {children}
      </li>
    );
  }
  return (
    <tr className={cls} data-selected={isSelected || undefined}>
      {children}
    </tr>
  );
}

/** Appears only once something is selected, so it never adds noise at rest. */
export function SelectionBar({
  noun = "record",
  plural,
  actions = ["export", "delete"],
  onDelete,
  onExport,
}: {
  noun?: string;
  /** Pass when the plural isn't just noun + "s" (entry → entries). */
  plural?: string;
  actions?: ("export" | "delete")[];
  /** Called with the selected ids, and a function that clears the selection. */
  onDelete?: (ids: string[], clear: () => void) => void;
  onExport?: (ids: string[], clear: () => void) => void;
}) {
  const { selected, clear } = useSelection();
  if (selected.size === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-slate-700">
        {selected.size} {selected.size === 1 ? noun : (plural ?? `${noun}s`)} selected
      </span>
      {actions.includes("export") && (
        <button
          type="button"
          onClick={() => onExport?.([...selected], clear)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-surface px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          Export
        </button>
      )}
      {actions.includes("delete") && (
        <button
          type="button"
          onClick={() => onDelete?.([...selected], clear)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-200 bg-surface px-3 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
        >
          <Trash2 className="h-3.5 w-3.5 text-brand-500" aria-hidden />
          Delete
        </button>
      )}
      <button
        type="button"
        onClick={clear}
        aria-label="Clear selection"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
