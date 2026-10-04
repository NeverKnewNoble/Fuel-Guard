"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY, type Theme } from "@/utils/theme";

// The <html data-theme> attribute is the source of truth: the root layout's inline script sets it
// before paint, and this toggle flips it. Subscribing to it keeps every toggle on screen in step.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const currentTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export default function ThemeToggle({ className = "" }: { className?: string }) {
  // The server can't know the saved theme, so it renders the light-mode button until hydration.
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${next} mode`;

  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // Storage blocked (private mode, site data off): the switch still holds for this visit.
        }
      }}
      aria-label={label}
      title={label}
      className={`rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 ${className}`}
    >
      {theme === "dark" ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  );
}
