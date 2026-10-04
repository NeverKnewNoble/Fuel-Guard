"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// The Navigation API reports whether there is anywhere to go back or forward to. Browsers without it
// (older Safari/Firefox) leave both buttons enabled, which is what the browser's own buttons fall back to.
type NavigationLike = EventTarget & { canGoBack: boolean; canGoForward: boolean };
const browserNavigation = () =>
  (globalThis as { navigation?: NavigationLike }).navigation;

const buttonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-surface text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface";

/** Back and forward buttons that behave like the browser's, for people using the portal full-screen or as an app. */
export default function HistoryNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [can, setCan] = useState({ back: true, forward: true });

  // Re-check whenever the current history entry changes, and on every route change as a backstop.
  useEffect(() => {
    const nav = browserNavigation();
    if (!nav) return;
    const update = () => setCan({ back: nav.canGoBack, forward: nav.canGoForward });
    update();
    nav.addEventListener("currententrychange", update);
    return () => nav.removeEventListener("currententrychange", update);
  }, [pathname]);

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => router.back()} disabled={!can.back} aria-label="Go back" title="Back" className={buttonClass}>
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <button type="button" onClick={() => router.forward()} disabled={!can.forward} aria-label="Go forward" title="Forward" className={buttonClass}>
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
