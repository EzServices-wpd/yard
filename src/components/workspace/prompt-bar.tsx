"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { DREAMS } from "@/lib/yard/prompt";
import { useYard } from "@/lib/yard/store";
import { YardsMenu } from "./yards-menu";
import { runYardPrompt } from "./run-prompt";

export function PromptBar({ onBuilt }: { onBuilt: () => void }) {
  const project = useYard((s) => s.project);
  const grokBusy = useYard((s) => s.grokBusy);
  const [value, setValue] = useState(project.prompt);

  useEffect(() => {
    if (project.prompt) setValue(project.prompt);
  }, [project.prompt]);

  async function run(raw: string, fresh = false) {
    const prompt = raw.trim();
    if (!prompt) return;
    setValue(prompt);
    onBuilt();
    await runYardPrompt(prompt, { fresh });
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
              : "table 40 round · tv console 70 wide · closet system"
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
        {DREAMS.filter((d) => d.group === "house").map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => void run(d.prompt, true)}
            className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-fg/30 hover:text-fg"
          >
            {d.label}
          </button>
        ))}
        <span className="shrink-0 pl-1 text-[10px] uppercase tracking-[0.14em] text-faint">Weekend</span>
        {DREAMS.filter((d) => d.group === "weekend").map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => void run(d.prompt, true)}
            className="shrink-0 rounded-full border border-border/70 px-3 py-1 text-xs text-faint hover:border-fg/30 hover:text-fg"
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
