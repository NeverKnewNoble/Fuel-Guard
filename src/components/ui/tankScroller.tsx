"use client";

import { ChevronLeft, ChevronRight, Fuel } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import EmptyState from "@/components/ui/emptyState";
import TankCard from "@/components/ui/tankCard";
import type { TankCardData } from "@/types/tank";

/** Above this count the row stops being a grid and becomes a horizontal scroller. */
const GRID_LIMIT = 4;

export default function TankScroller({ tanks, emptyAction }: { tanks: TankCardData[]; emptyAction?: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const scrolls = tanks.length > GRID_LIMIT;

  const sync = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    if (!scrolls) return;
    const el = scrollerRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [scrolls, sync]);

  function nudge(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    // Move by roughly one card so a full card always lands in view.
    el.scrollBy({ left: direction * (el.clientWidth * 0.8), behavior: "smooth" });
  }

  const totalAvailable = tanks.reduce((sum, t) => sum + t.currentL, 0);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-slate-900">Fuel tankers</h2>
      <p className="text-sm text-slate-500">
        {totalAvailable.toLocaleString()} L available across {tanks.length} {tanks.length === 1 ? "tank" : "tanks"}
      </p>
    </div>
  );

  if (tanks.length === 0) {
    return (
      <section>
        {header}
        <div className="mt-3">
          <EmptyState
            bordered
            icon={Fuel}
            title="No tankers yet"
            description="Add a tanker with its capacity and opening level to start tracking stock."
            action={emptyAction}
          />
        </div>
      </section>
    );
  }

  if (!scrolls) {
    return (
      <section>
        {header}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tanks.map((tank) => (
            <TankCard key={tank.id} tank={tank} />
          ))}
        </div>
      </section>
    );
  }

  const arrowClass =
    "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-lg backdrop-blur transition-all hover:scale-105 hover:bg-brand-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-95 sm:h-16 sm:w-16";

  return (
    <section>
      {header}
      <div className="relative mt-3">
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:thin]"
        >
          {tanks.map((tank) => (
            <div
              key={tank.id}
              className="w-[17rem] shrink-0 snap-start sm:w-[19rem]"
            >
              <TankCard tank={tank} />
            </div>
          ))}
        </div>

        {/* Edge fades hint that more cards sit off-screen */}
        {!atStart && (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-slate-50 to-transparent" />
        )}
        {!atEnd && (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-50 to-transparent" />
        )}

        {!atStart && (
          <button
            type="button"
            aria-label="Scroll tankers left"
            onClick={() => nudge(-1)}
            className={`${arrowClass} left-2`}
          >
            <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.5} aria-hidden />
          </button>
        )}
        {!atEnd && (
          <button
            type="button"
            aria-label="Scroll tankers right"
            onClick={() => nudge(1)}
            className={`${arrowClass} right-2`}
          >
            <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.5} aria-hidden />
          </button>
        )}
      </div>
    </section>
  );
}
