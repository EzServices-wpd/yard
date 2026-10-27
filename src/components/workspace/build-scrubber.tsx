"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { useYard } from "@/lib/yard/store";
import { revealState, subscribeReveal } from "./reveal-clock";
import { playGap, scrubBeat, scrubCounter, scrubLabel, scrubState, scrubTrack, setScrub, subscribeScrub } from "./build-scrub";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const BTN = "grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-elevated hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-30";

/**
 * Watch it build (PR 10): a "Watch it build" button on the bench opens a step scrubber. Drag the
 * slider (or arrow keys, Home, End) to walk the plan's steps; parts done so far show in wood, the
 * rest as outlines. Play steps through on its own, only when pressed (and pauses off screen or in a
 * background tab); with reduced motion it opens on the finished build and moves only when asked.
 * Closing it, or reaching the last step, shows the same finished frame as before it opened. The closed
 * button is not a bench card (no data-bench-overlay), so the default framing is release's exactly; only
 * the open bar is one, and the camera refits around it while it is open.
 */
export function BuildScrubber() {
  const project = useYard((s) => s.project);
  const plan = useYard((s) => s.plan);
  const pending = useYard((s) => s.building || s.grokBusy);
  const activeStep = useYard((s) => s.activeStep);
  const setActiveStep = useYard((s) => s.setActiveStep);
  const explode = useYard((s) => s.explode);
  const setExplode = useYard((s) => s.setExplode);
  const walking = useYard((s) => s.workMode === "walk");
  const revealing = useSyncExternalStore(subscribeReveal, () => revealState().active, () => false);
  const { open, k } = useSyncExternalStore(subscribeScrub, scrubState, scrubState);
  const track = useMemo(() => (pending ? null : scrubTrack(project, plan)), [project, plan, pending]);
  const [playing, setPlaying] = useState(false);
  const n = track?.beats.length ?? 0;
  const usable = !!track && !walking && !revealing;

  // Anything else taking the bench (a step view, See inside, a rebuild, walking) closes the scrubber.
  const close = () => { setPlaying(false); setScrub({ open: false, k: 0 }); };
  useEffect(() => { if (open && (!usable || activeStep != null || explode)) close(); }, [open, usable, activeStep, explode]);
  useEffect(() => close, [project.id]);

  // Play: one beat per gap, paused while the tab is hidden or the bench is scrolled off screen.
  const seen = useRef(true);
  useEffect(() => {
    const host = document.querySelector("[data-bench-host]");
    if (!host || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => void (seen.current = e.isIntersecting));
    io.observe(host);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!playing || !open) return;
    const t = window.setInterval(() => {
      if (document.hidden || !seen.current) return;
      const next = Math.min(n, scrubState().k + 1);
      setScrub({ k: next });
      if (next >= n) setPlaying(false);
    }, playGap(n));
    return () => window.clearInterval(t);
  }, [playing, open, n]);

  if (!usable) return null;
  const go = (v: number) => { setPlaying(false); setScrub({ k: Math.max(1, Math.min(n, v)) }); };

  if (!open) {
    return (
      <button
        type="button"
        data-yard-scrub="closed"
        onClick={() => {
          setActiveStep(null);
          setExplode(false);
          const still = reducedMotion();
          setScrub({ open: true, k: still ? n : 1 });
          setPlaying(!still);
        }}
        aria-label="Watch it build"
        className="absolute right-3 top-12 z-20 inline-flex size-11 items-center justify-center gap-1.5 rounded-full border border-border bg-surface/90 text-sm text-fg shadow-lg backdrop-blur hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:top-3 sm:w-auto sm:px-4"
      >
        <Play className="size-4" aria-hidden /> <span className="max-sm:sr-only">Watch it build</span>
      </button>
    );
  }

  const label = scrubLabel(track!, k);
  return (
    <div
      role="group"
      aria-label="Watch it build"
      data-yard-scrub={`${k}/${n}`}
      data-bench-overlay="scrub"
      className="absolute left-1/2 top-3 z-20 w-[min(34rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border border-border bg-surface/95 px-2 py-1.5 shadow-lg backdrop-blur"
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}
    >
      <p className="truncate px-2 pt-0.5 text-xs text-muted" aria-hidden>
        <span className="font-mono text-faint" data-yard-scrub-counter>{scrubCounter(track!, k)}</span>{" "}
        <span className="text-fg">{scrubBeat(track!, k).title}</span>
      </p>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className={BTN}
          aria-label={playing ? "Pause" : k >= n ? "Play from the first step" : "Play"}
          aria-pressed={playing}
          onClick={() => {
            if (playing) return setPlaying(false);
            if (k >= n) setScrub({ k: 1 });
            setPlaying(true);
          }}
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </button>
        <button type="button" className={BTN} aria-label="Previous step" disabled={k <= 1} onClick={() => go(k - 1)}>
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <input
          type="range"
          min={1}
          max={n}
          step={1}
          value={k}
          aria-label="Build step"
          aria-valuetext={label}
          data-yard-scrub-slider
          onChange={(e) => go(Number(e.target.value))}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <button type="button" className={BTN} aria-label="Next step" disabled={k >= n} onClick={() => go(k + 1)}>
          <ChevronRight className="size-4" aria-hidden />
        </button>
        <button type="button" className={BTN} aria-label="Close Watch it build, show the finished build" onClick={close}>
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
