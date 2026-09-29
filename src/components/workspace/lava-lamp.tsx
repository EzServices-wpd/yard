"use client";

import { useEffect, useState } from "react";

const BEATS = [
  "Heating the stock",
  "Counting every piece",
  "Laying each face",
  "Squaring the joints",
  "Setting it on the bench",
];

export function LavaLamp({ caption }: { caption?: string }) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setBeat((n) => (n + 1) % BEATS.length), 900);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-bg/75"
      role="status"
      aria-live="polite"
      aria-label={caption ?? "Building"}
      data-yard-building="1"
    >
      <div className="flex flex-col items-center gap-6">
        <div className="lava-rig" aria-hidden>
          <span className="lava-halo" />
          <span className="lava-halo lava-halo-b" />
          <span className="lava-ring" />
          <span className="lava-ring lava-ring-b" />
          <div className="lava-stage">
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
            </span>
            <span className="lava-orbit lava-orbit-b">
              <span className="lava-spark lava-spark-d" />
              <span className="lava-spark lava-spark-e" />
            </span>
          </div>
          <span className="lava-ember" />
          <span className="lava-ember lava-ember-b" />
          <span className="lava-ember lava-ember-c" />
          <span className="lava-ember lava-ember-d" />
          <span className="lava-ember lava-ember-e" />
        </div>
        <div className="text-center">
          <p className="font-display text-2xl tracking-tight text-fg">{caption ?? "Building"}</p>
          <p key={beat} className="lava-beat mt-1 font-mono text-xs uppercase tracking-[0.18em] text-muted">
            {BEATS[beat]}
          </p>
        </div>
      </div>
    </div>
  );
}
