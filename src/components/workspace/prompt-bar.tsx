"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { DREAMS } from "@/lib/yard/prompt";
import { interpretPrompt } from "@/lib/ai/grok";
import { useYard } from "@/lib/yard/store";

export function PromptBar({ onBuilt }: { onBuilt: () => void }) {
  const project = useYard((s) => s.project);
  const generate = useYard((s) => s.generate);
  const makePlan = useYard((s) => s.makePlan);
  const grokBusy = useYard((s) => s.grokBusy);
  const [value, setValue] = useState(project.prompt);

  useEffect(() => {
    if (project.prompt) setValue(project.prompt);
  }, [project.prompt]);

  async function run(raw: string) {
    const prompt = raw.trim();
    if (!prompt) return;
    setValue(prompt);
    const next = generate(prompt);
    makePlan();
    onBuilt();
    if (next.kind === "closet" || next.kind === "opening") return;
    useYard.setState({ grokBusy: true, grokError: null });
    const timeout = window.setTimeout(() => useYard.setState({ grokBusy: false }), 22000);
    try {
      const interp = await interpretPrompt({ data: { prompt, heightIn: next.overall.height, widthIn: next.overall.width } });
      if (interp.ok && interp.form && next.kind !== "eiffel") {
        generate(prompt, interp.materialId ?? undefined, interp.form);
        makePlan();
      } else if (interp.ok && interp.materialId && interp.materialId !== next.primaryMaterialId) {
        generate(prompt, interp.materialId);
        makePlan();
      }
      if (interp.ok && (interp.real || interp.notes)) {
        const current = useYard.getState().project;
        const extra = [interp.real ? `Queried form: ${interp.real}` : "", interp.notes].filter(Boolean);
        useYard.getState().setProject({ ...current, notes: [...current.notes, ...extra.filter((n) => !current.notes.includes(n))] });
      }
    } catch { /* deterministic already on the bench */ }
    finally {
      window.clearTimeout(timeout);
      useYard.setState({ grokBusy: false });
    }
  }

  return (
    <div className="shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-4">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void run(value); }}>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="3 foot Eiffel Tower from popsicle sticks" className="h-11 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none ring-fg/15 placeholder:text-faint focus:ring-2" />
        <button type="submit" disabled={grokBusy} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-60">
          {grokBusy ? "Querying true form…" : "Generate"}
          <ArrowRight className="size-4" />
        </button>
      </form>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {DREAMS.map((d) => (
          <button key={d.id} type="button" onClick={() => void run(d.prompt)} className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-fg/30 hover:text-fg">{d.label}</button>
        ))}
      </div>
    </div>
  );
}
