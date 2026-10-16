"use client";

import { useEffect, useSyncExternalStore } from "react";
import { revealState, skipReveal, subscribeReveal } from "./reveal-clock";

/**
 * The reveal's one status line and its ruler (UX plan item 1, direction A as the status line):
 * "Cutting 10 parts · 4 of 10" over a 1 px rule with 1/16″-style ticks that fills as parts turn to
 * wood (transform only). A tap or click anywhere on the bench skips to the finished frame. Fixed
 * size and absolutely placed, so it never moves the layout.
 */
export function RevealStatus() {
  const r = useSyncExternalStore(subscribeReveal, revealState, revealState);
  useEffect(() => {
    if (!r.active) return;
    const host = document.querySelector("[data-bench-host]");
    const skip = () => skipReveal();
    // Capture phase: the orbit controls own the canvas's pointer events.
    host?.addEventListener("pointerdown", skip, { capture: true });
    host?.addEventListener("touchstart", skip, { capture: true, passive: true });
    return () => {
      host?.removeEventListener("pointerdown", skip, { capture: true });
      host?.removeEventListener("touchstart", skip, { capture: true });
    };
  }, [r.active]);
  if (!r.active || !r.n) return null;
  const k = Math.min(r.wood, r.n);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-12 z-10 flex flex-col items-center gap-2" role="status" aria-live="polite" data-yard-reveal-status>
      <p className="font-display text-[18px] text-fg sm:text-[20px]">
        {k === 0 ? `Cutting ${r.n} parts` : `Cutting ${r.n} parts · ${k} of ${r.n}`}
      </p>
      <div className="yard-ruler relative h-[7px] w-[120px] sm:w-[160px]" aria-hidden>
        <span className="absolute inset-x-0 bottom-0 h-px bg-fg/25" />
        <span className="absolute inset-x-0 bottom-0 h-px origin-left bg-accent transition-transform duration-100" style={{ transform: `scaleX(${k / r.n})` }} />
      </div>
      <span className="sr-only">Tap the model or press Escape to skip.</span>
    </div>
  );
}
