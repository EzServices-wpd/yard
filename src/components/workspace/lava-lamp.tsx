"use client";

export function LavaLamp({ caption }: { caption?: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-bg/80"
      role="status"
      aria-live="polite"
      aria-label={caption ?? "Building"}
      data-yard-building="1"
    >
      <div className="flex flex-col items-center gap-6">
        <div className="lava-stage" aria-hidden>
          <span className="lava-blob lava-a" />
          <span className="lava-blob lava-b" />
          <span className="lava-blob lava-c" />
          <span className="lava-blob lava-d" />
          <span className="lava-blob lava-e" />
        </div>
        <p className="font-display text-xl text-fg">{caption ?? "Building"}</p>
      </div>
    </div>
  );
}
