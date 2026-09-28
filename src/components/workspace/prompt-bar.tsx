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
    <div className="relative z-30 shrink-0 border-b border-border bg-surface px-2 py-2 sm:px-4 sm:py-3">
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
          placeholder={housePath ? "taller · 36 wide · or type a new opening" : "bathroom vanity, 36 wide"}
          aria-label="What do you want to build?"
          enterKeyHint="go"
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-base text-fg outline-none ring-fg/15 placeholder:text-faint focus:ring-2 sm:text-sm"
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
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg disabled:opacity-60 sm:px-4"
        >
          {grokBusy ? "…" : "Go"}
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
        onExample={(p) => void run(p, true)}
      />
    </div>
  );
}
