"use client";

import { useEffect, useState } from "react";

const BEATS = ["Counting every piece", "Laying each face", "Matching the stock", "Squaring the joints"];

export function LavaLamp({ caption }: { caption?: string }) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setBeat((n) => (n + 1) % BEATS.length), 1300);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-bg/80"
      role="status"
      aria-live="polite"
      aria-label={caption ?? "Building"}
      data-yard-building="1"
    >
      <div className="flex flex-col items-center gap-5">
        <div className="lava-stage" aria-hidden>
          <span className="lava-glow" />
          <span className="lava-blob lava-a" />
          <span className="lava-blob lava-b" />
          <span className="lava-blob lava-c" />
          <span className="lava-blob lava-d" />
          <span className="lava-blob lava-e" />
          <span className="lava-orbit">
            <span className="lava-spark" />
            <span className="lava-spark lava-spark-b" />
            <span className="lava-spark lava-spark-c" />
            <span className="lava-spark lava-spark-d" />
          </span>
        </div>
        <div className="text-center">
          <p className="font-display text-xl text-fg">{caption ?? "Building"}</p>
          <p key={beat} className="lava-beat mt-1 font-mono text-xs text-muted">
            {BEATS[beat]}
          </p>
        </div>
      </div>
    </div>
  );
}
