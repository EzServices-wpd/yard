"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useYard } from "@/lib/yard/store";
import { refineChips, refineProject, type RefineResult } from "@/lib/yard/refine";
import { noteRefine } from "./refine-note";

/**
 * Spec 003: free Refine box under the model. One change at a time to the build on the bench (size, a count,
 * the stock), shown with Undo. Never a new build, never an AI call.
 */
/** `trailing` sits on the input row (Open the plan, More); chips show only when `showChips` (the tray). */
export function RefineBox({ trailing, showChips = true }: { trailing?: ReactNode; showChips?: boolean } = {}) {
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<RefineResult | null>(null);
  const project = useYard((s) => s.project);
  const [chips, setChips] = useState<ReturnType<typeof refineChips>>([]);
  useEffect(() => {
    // Checked after paint: each chip is a trial rebuild, so the bench never waits on it.
    const t = window.setTimeout(() => setChips(project.prompt.trim() ? refineChips(project) : []), 60);
    return () => window.clearTimeout(t);
  }, [project]);
  function apply(phrase: string) {
    const s = useYard.getState();
    if (!phrase.trim() || !s.project.prompt.trim()) return;
    const r = refineProject(s.project, phrase);
    if (r.project) {
      noteRefine();
      s.commit(r.project);
      s.makePlan();
      setValue("");
    }
    setMsg(r);
  }
  return (
    <div data-yard-refine="1" className="border-t border-border/60 px-3 py-2">
      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); apply(value); }}>
        <label htmlFor="yard-refine" className="sr-only">Refine</label>
        <input
          id="yard-refine"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Taller, add a drawer, use pine…"
          aria-label="Refine this build"
          autoComplete="off"
          enterKeyHint="done"
          className="yard-glass h-11 min-w-0 flex-1 rounded-full border border-border/80 bg-surface px-4 text-base text-fg outline-none ring-fg/15 placeholder:text-faint focus:ring-2 sm:text-sm"
        />
        {trailing}
      </form>
      {showChips && chips.length > 0 && (
        <div data-yard-refine-chips="1" className="yard-tray mt-2 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button key={c.label} type="button" onClick={() => apply(c.phrase)} className="inline-flex h-11 items-center rounded-full border border-border px-4 text-sm text-fg hover:bg-elevated">
              {c.label}
            </button>
          ))}
        </div>
      )}
      {msg && (
        <div data-yard-refine-result={msg.project ? "changed" : "kept"} className="mt-1 space-y-0.5 text-xs text-muted">
          {msg.applied.length > 0 && (
            <p className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-fg">Changed: {msg.applied.join(" · ")}</span>
              <button type="button" className="inline-flex h-11 shrink-0 items-center rounded-full px-3 text-fg hover:bg-elevated" onClick={() => { const s = useYard.getState(); s.undo(); s.makePlan(); setMsg(null); }}>
                Undo
              </button>
            </p>
          )}
          {msg.refused.map((t) => <p key={t}>Kept as is: {t}.</p>)}
          {msg.conflicts.map((t) => <p key={t}>Conflict: {t}.</p>)}
          {msg.notUnderstood.length > 0 && <p>Didn't understand "{msg.notUnderstood.join('", "')}". Try a size ("2 inches taller"), a count ("add a shelf") or a stock ("use plywood"); anything else goes in the prompt above.</p>}
        </div>
      )}
    </div>
  );
}
