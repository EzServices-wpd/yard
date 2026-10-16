"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

type Phase = "build" | "busy" | "plan";

/**
 * Item 3: the one filled button on the workbench (Von Restorff). It reads "Build →", turns into
 * progress the instant it is pressed (Doherty: feedback well under 400 ms, before the solve even
 * starts), and becomes "Get the plan →" once the build lands. Editing the prompt turns it back
 * into "Build". All three labels share one grid cell, so the button never changes width (CLS 0);
 * they crossfade (160 ms, opacity/transform only; reduced motion: a plain swap).
 */
export function MorphButton({ pending, built, dirty, onPlan }: { pending: boolean; built: boolean; dirty: boolean; onPlan: () => void }) {
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    const on = () => setPressed(true);
    window.addEventListener("yard-build-start", on);
    return () => window.removeEventListener("yard-build-start", on);
  }, []);
  useEffect(() => {
    if (!pressed) return;
    if (pending) return setPressed(false);
    const t = window.setTimeout(() => setPressed(false), 4000);
    return () => window.clearTimeout(t);
  }, [pressed, pending]);
  const phase: Phase = pending || pressed ? "busy" : built && !dirty ? "plan" : "build";
  const label = (p: Phase, text: string, arrow = true) => (
    <span
      aria-hidden={phase !== p}
      className="yard-morph-label col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5"
      style={{ opacity: phase === p ? 1 : 0, transform: phase === p ? "none" : "translateY(4px)" }}
    >
      {text}
      {arrow && <ArrowRight className="size-4" aria-hidden />}
    </span>
  );
  return (
    <button
      type={phase === "plan" ? "button" : "submit"}
      form={phase === "plan" ? undefined : "yard-prompt-form"}
      data-yard-primary={phase}
      aria-busy={phase === "busy"}
      aria-label={phase === "plan" ? "Get the plan" : phase === "busy" ? "Building" : "Build this"}
      onClick={(e) => {
        if (phase === "busy") return e.preventDefault();
        if (phase === "plan") return onPlan();
      }}
      className="relative grid h-11 shrink-0 place-items-center overflow-hidden rounded-full bg-accent px-4 text-sm font-medium text-accent-fg active:scale-[0.97] sm:h-10"
    >
      {label("build", "Build")}
      {label("busy", "Building", false)}
      {label("plan", "Get the plan")}
      {phase === "busy" && (
        <span aria-hidden className="pointer-events-none absolute inset-x-3 bottom-1.5 h-px overflow-hidden">
          <span className="yard-morph-bar block h-px w-2/5 bg-accent-fg/70" />
        </span>
      )}
    </button>
  );
}
