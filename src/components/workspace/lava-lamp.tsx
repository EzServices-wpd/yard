"use client";

/**
 * Building overlay: four parts fly from exploded to assembled into a box, then repeat until the build lands
 * (the bench unmounts this when pending clears; the real model then assembles itself). CSS only; still under
 * reduced motion. Never takes pointer events, so the prompt and model stay usable.
 */
export function LavaLamp({ caption }: { caption?: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-bg/40"
      role="status"
      aria-live="polite"
      aria-label={caption ?? "Building"}
      data-yard-building="1"
    >
      <div className="flex flex-col items-center gap-4">
        <svg className="yard-assemble" width="96" height="96" viewBox="0 0 96 96" aria-hidden>
          <g fill="none" stroke="currentColor" strokeWidth="2">
            <rect className="ya ya-l" x="22" y="22" width="8" height="52" rx="1" />
            <rect className="ya ya-r" x="66" y="22" width="8" height="52" rx="1" />
            <rect className="ya ya-t" x="22" y="22" width="52" height="8" rx="1" />
            <rect className="ya ya-b" x="22" y="66" width="52" height="8" rx="1" />
          </g>
        </svg>
        <p className="font-display text-2xl tracking-tight text-fg">{caption ?? "Building"}</p>
      </div>
    </div>
  );
}
