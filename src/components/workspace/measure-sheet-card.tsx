"use client";

import { useEffect } from "react";
import { SHEET_GAP_QUERY, setSheetGap } from "@/components/workspace/measure-sheet-gap";

/** The phone Measure sheet's card in the bench host (state and why: measure-sheet-gap.ts). */
export function MeasureSheetGap({ show }: { show: boolean }) {
  useEffect(() => {
    if (!show) return;
    const mq = window.matchMedia(SHEET_GAP_QUERY);
    const sync = () => setSheetGap(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      setSheetGap(false);
    };
  }, [show]);
  if (!show) return null;
  // Same box as the sheet: bottom of the bench, 50vh tall. Clear and inert; md:hidden keeps it out of the desktop fit.
  return <div aria-hidden data-bench-overlay="measure-sheet" data-yard-sheet-gap="1" className="pointer-events-none absolute inset-x-0 bottom-0 h-[50vh] md:hidden" />;
}
