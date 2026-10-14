"use client";

import { useState } from "react";
import { useYard } from "@/lib/yard/store";
import { refinePrompt } from "@/lib/yard/refine";

/** Spec 003: free Refine box under the model. Rebuilds through the parser like a stock switch; no AI. */
export function RefineBox() {
  const [value, setValue] = useState("");
  const [done, setDone] = useState("");
  return (
    <form
      data-yard-refine="1"
      className="flex items-center gap-2 border-t border-border/60 px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        const s = useYard.getState();
        const p = s.project;
        const base = p.typedPrompt || p.prompt;
        if (!value.trim() || !base.trim()) return;
        const r = refinePrompt(base, value, p);
        s.generate(r.prompt, r.materialId ?? p.primaryMaterialId, undefined, { includeSpine: p.supportOffer?.included, fresh: true, keepView: true });
        s.makePlan();
        s.revealBench();
        setDone(value.trim());
        setValue("");
      }}
    >
      <label htmlFor="yard-refine" className="shrink-0 text-xs font-medium text-fg">Refine</label>
      <input
        id="yard-refine"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={done ? `Done: ${done}. Anything else?` : "make it 6 inches taller · add a drawer · use plywood"}
        autoComplete="off"
        enterKeyHint="done"
        className="h-8 min-w-0 flex-1 rounded-full border border-border/80 bg-surface px-3 text-sm text-fg outline-none ring-fg/15 placeholder:text-faint focus:ring-2"
      />
      <button type="submit" className="h-8 shrink-0 rounded-full bg-accent px-3 text-xs font-medium text-accent-fg">Apply</button>
    </form>
  );
}
