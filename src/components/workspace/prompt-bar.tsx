"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useYard } from "@/lib/yard/store";
import { runYardPrompt } from "./run-prompt";
import { BenchOptionsPanel, BenchOptionsToggle } from "./bench-options";

/**
 * The bench's query bar. The only thing attached to it is one Options dropdown — material, size,
 * view, build options, examples and saved yards all live in there, not in loose rows below.
 */
export function PromptBar({
  onBuilt,
  onStock,
  onMeasure,
}: {
  onBuilt: () => void;
  onStock: () => void;
  onMeasure: () => void;
}) {
  const project = useYard((s) => s.project);
  const grokBusy = useYard((s) => s.grokBusy);
  const [value, setValue] = useState(project.prompt);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const housePath = project.kind === "closet" || project.kind === "opening" || Boolean(project.fitted) || Boolean(project.pocket);

  useEffect(() => {
    if (project.prompt) setValue(project.prompt);
  }, [project.prompt]);

  const closeOptions = useCallback((focusToggle?: boolean) => {
    setOptionsOpen(false);
    if (focusToggle) toggleRef.current?.focus();
  }, []);

  async function run(raw: string, fresh = false) {
    const prompt = raw.trim();
    if (!prompt) return;
    setValue(prompt);
    setOptionsOpen(false);
    onBuilt();
    await runYardPrompt(prompt, { fresh });
  }

  return (
    <div className="relative z-30 shrink-0 border-b border-border/80 bg-bg/40 px-3 py-2 sm:px-5 sm:py-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(value);
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={housePath ? "along the other wall · under the slope · or a new opening" : "corner shelf, 24 inches along each wall"}
          aria-label="What do you want to build?"
          enterKeyHint="go"
          className="h-11 min-w-0 flex-1 rounded-full border border-border/80 bg-surface px-4 text-base text-fg outline-none ring-fg/15 placeholder:text-faint focus:ring-2 sm:text-sm"
        />
        <BenchOptionsToggle
          open={optionsOpen}
          onToggle={() => setOptionsOpen((v) => !v)}
          panelId={panelId}
          buttonRef={toggleRef}
        />
        <button
          type="submit"
          disabled={grokBusy}
          aria-label="Build this"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1 rounded-full bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-60"
        >
          {grokBusy ? "…" : "Build"}
          <ArrowRight className="size-4" />
        </button>
      </form>
      <BenchOptionsPanel
        open={optionsOpen}
        onClose={closeOptions}
        panelId={panelId}
        toggleRef={toggleRef}
        onStock={onStock}
        onMeasure={onMeasure}
      />
    </div>
  );
}
