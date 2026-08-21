"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { DREAMS } from "@/lib/yard/prompt";
import { hintSubject, interpretPrompt } from "@/lib/ai/grok";
import { recipeFromAnatomy, isLockedForm } from "@/lib/yard/form";
import { useYard } from "@/lib/yard/store";
import { YardsMenu } from "./yards-menu";

export function PromptBar({ onBuilt }: { onBuilt: () => void }) {
  const project = useYard((s) => s.project);
  const generate = useYard((s) => s.generate);
  const makePlan = useYard((s) => s.makePlan);
  const grokBusy = useYard((s) => s.grokBusy);
  const revealBench = useYard((s) => s.revealBench);
  const [value, setValue] = useState(project.prompt);

  useEffect(() => {
    if (project.prompt) setValue(project.prompt);
  }, [project.prompt]);

  async function run(raw: string, fresh = false) {
    const prompt = raw.trim();
    if (!prompt) return;
    setValue(prompt);
    const next = generate(prompt, undefined, undefined, { fresh });
    makePlan();
    onBuilt();
    if (next.kind === "closet" || next.kind === "opening" || isLockedForm(next.kind)) {
      revealBench();
      return;
    }
    const offline =
      typeof window !== "undefined" &&
      /(?:^|[?&])(?:local|offline)=1/.test(window.location.search);
    if (offline) {
      revealBench();
      return;
    }
    useYard.setState({ grokBusy: true, grokError: null, building: true });
    const timeout = window.setTimeout(() => {
      useYard.setState({ grokBusy: false });
      revealBench();
    }, 22000);
    try {
      const hint = await hintSubject({ data: { prompt } });
      if (hint.summary && hint.summary !== hint.subject) {
        const form = recipeFromAnatomy(`${prompt} ${hint.summary}`, next.overall);
        generate(prompt, undefined, form);
        makePlan();
        const current = useYard.getState().project;
        const note = `Looked up: ${hint.summary}`;
        if (!current.notes.includes(note)) {
          useYard.getState().setProject({ ...current, notes: [...current.notes, note] });
        }
      }
      const interp = await interpretPrompt({
        data: { prompt, heightIn: next.overall.height, widthIn: next.overall.width },
      });
      const after = useYard.getState().project;
      if (interp.ok && interp.form && interp.form.strokes && interp.form.strokes.length >= 2 && !isLockedForm(after.kind)) {
        generate(prompt, interp.materialId ?? undefined, interp.form);
        makePlan();
      } else if (interp.ok && interp.form && !isLockedForm(after.kind) && after.kind !== "closet" && after.kind !== "opening") {
        generate(prompt, interp.materialId ?? undefined, interp.form);
        makePlan();
      } else if (interp.ok && interp.materialId && interp.materialId !== after.primaryMaterialId && !isLockedForm(after.kind)) {
        generate(prompt, interp.materialId);
        makePlan();
      }
      if (interp.ok && (interp.real || interp.notes)) {
        const current = useYard.getState().project;
        const extra = [interp.real ? `Queried form: ${interp.real}` : "", interp.notes].filter(Boolean);
        useYard.getState().setProject({
          ...current,
          notes: [...current.notes, ...extra.filter((n) => !current.notes.includes(n))],
        });
      }
    } catch {
      /* deterministic already on the bench */
    } finally {
      window.clearTimeout(timeout);
      useYard.setState({ grokBusy: false });
      revealBench();
    }
  }

  return (
    <div className="shrink-0 border-b border-border bg-surface px-2 py-2 sm:px-4 sm:py-3">
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
          placeholder={
            project.prompt
              ? "taller · from 2x4 · or type a new thing"
              : "3 foot Eiffel Tower from popsicle sticks"
          }
          enterKeyHint="go"
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-base text-fg outline-none ring-fg/15 placeholder:text-faint focus:ring-2 sm:text-sm"
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
      <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
        <YardsMenu />
        {DREAMS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => void run(d.prompt, true)}
            className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-fg/30 hover:text-fg"
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
