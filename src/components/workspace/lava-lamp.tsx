"use client";

import { useEffect, useState } from "react";
import previews from "@/components/workspace/build-previews.json";

type Preview = { id: string; match: string; w: number; h: number; steps: number; parts: [number, number, number, number, number][] };
const PREVIEWS = previews as Preview[];

/** The known build closest to what was asked (closet, case, desk/table); a bookcase when nothing matches. */
export function previewFor(prompt?: string): Preview {
  const p = (prompt ?? "").toLowerCase();
  return PREVIEWS.find((v) => new RegExp(v.match).test(p)) ?? PREVIEWS.find((v) => v.id === "bookcase") ?? PREVIEWS[0];
}

/**
 * Building overlay: while the model is pending, a real Yard build of the nearest known type
 * (snapshotted from engine output by scripts/gen-build-previews.mjs) goes together part by part in
 * plan step order, then repeats. CSS transform/opacity only, so it never competes with the build.
 * When the real model lands the overlay crossfades out over it. Reduced motion: the finished drawing, still.
 */
export function LavaLamp({ caption, show = true, prompt }: { caption?: string; show?: boolean; prompt?: string }) {
  const [mounted, setMounted] = useState(show);
  useEffect(() => {
    if (show) return setMounted(true);
    const t = window.setTimeout(() => setMounted(false), 450);
    return () => window.clearTimeout(t);
  }, [show]);
  const [pv] = useState(() => previewFor(prompt));
  if (!mounted) return null;
  const pad = Math.max(pv.w, pv.h) * 0.08;
  const per = Math.min(0.55, 2.2 / pv.steps);
  const cycle = per * pv.steps + 1.4;
  return (
    <div
      className={`yard-lamp pointer-events-none absolute inset-0 z-20 grid place-items-center bg-bg/40 transition-opacity duration-[450ms] ease-out ${show ? "opacity-100" : "opacity-0"}`}
      role="status"
      aria-live="polite"
      aria-label={caption ?? "Building"}
      data-yard-building={show ? "1" : undefined}
      data-yard-build-preview={pv.id}
    >
      <div className="flex flex-col items-center gap-4">
        <svg
          className="yard-assemble-real h-40 w-40 text-fg"
          viewBox={`${-pad} ${-pad} ${pv.w + 2 * pad} ${pv.h + 2 * pad}`}
          style={{ ["--cycle" as string]: `${cycle}s` }}
          aria-hidden
        >
          <g fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth={Math.max(pv.w, pv.h) / 120} vectorEffect="non-scaling-stroke">
            {pv.parts.map(([x, y, w, h, k], i) => (
              <rect key={i} className="yp" x={x} y={y} width={w} height={h} style={{ ["--d" as string]: `${(k * per).toFixed(2)}s` }} />
            ))}
          </g>
        </svg>
        <p className="font-display text-2xl tracking-tight text-fg">{caption ?? "Building"}</p>
      </div>
    </div>
  );
}
