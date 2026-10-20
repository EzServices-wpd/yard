"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CornerDownLeft } from "lucide-react";
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
  onDirty,
}: {
  onBuilt: () => void;
  onStock: () => void;
  onMeasure: () => void;
  /** True while the box holds text other than the build on the bench (the main button reads "Build"). */
  onDirty?: (dirty: boolean) => void;
}) {
  const project = useYard((s) => s.project);
  const grokBusy = useYard((s) => s.grokBusy);
  // A fallback build runs on an internal primitive prompt; the box shows what was typed.
  const shown = project.typedPrompt || project.prompt;
  const [value, setValue] = useState(shown);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const housePath = project.kind === "closet" || project.kind === "opening" || Boolean(project.fitted) || Boolean(project.pocket);

  useEffect(() => {
    if (shown) setValue(shown);
  }, [shown]);
  const dirty = value.trim() !== (shown ?? "").trim() || !shown;
  useEffect(() => onDirty?.(dirty), [dirty, onDirty]);

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
    // Doherty: the main button flips to "Building" first, then the solve starts after that frame
    // is painted, so the press is answered in well under 400 ms even when the solve blocks.
    window.dispatchEvent(new Event("yard-build-start"));
    await new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    await runYardPrompt(prompt, { fresh });
  }

  return (
    <div className="relative z-30 shrink-0 border-b border-border/80 bg-bg/40 px-3 py-2 sm:px-5 sm:py-3">
      <form
        id="yard-prompt-form"
        className="flex flex-wrap gap-2 sm:flex-nowrap"
        onSubmit={(e) => {
          e.preventDefault();
          void run(value);
        }}
      >
        <div className="relative w-full min-w-0 sm:flex-1">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={housePath ? "along the other wall · under the slope · or a new opening" : "corner shelf, 24 inches along each wall"}
            aria-label="What do you want to build?"
            enterKeyHint="go"
            autoCapitalize="off"
            spellCheck={false}
            className="h-11 w-full rounded-full border border-border/80 bg-surface pl-4 pr-12 text-base text-fg outline-none ring-fg/15 placeholder:text-faint focus:ring-2 sm:text-sm"
          />
          {/* Jakob's: Enter (or this ↵) builds, like any search box. The filled main button is in the header. */}
          <button
            type="submit"
            disabled={grokBusy}
            aria-label="Build this"
            className="absolute right-0 top-0 grid size-11 place-items-center rounded-full text-muted hover:text-fg disabled:opacity-40"
          >
            <CornerDownLeft className="size-4" aria-hidden />
          </button>
        </div>
        <BenchOptionsToggle
          open={optionsOpen}
          onToggle={() => setOptionsOpen((v) => !v)}
          onStock={() => {
            setOptionsOpen(false);
            onStock();
          }}
          panelId={panelId}
          buttonRef={toggleRef}
        />
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
