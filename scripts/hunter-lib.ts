/**
 * I37 silent-fallback hunter over the eval corpus: evals/corpus/*.json when the eval gate's corpus is on this branch
 * (PR #102), else the snapshot in evals/hunter-corpus.json. Offline: no network, no xAI.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { buildPlan } from "../src/lib/yard/report.ts";
import { hunt } from "../src/lib/yard/hunter.ts";

export type HunterRow = { src: string; id: string; prompt: string };
const root = new URL("../", import.meta.url);

/** Every distinct corpus prompt with its source. */
export function hunterCorpus(): HunterRow[] {
  const dir = new URL("evals/corpus/", root);
  const rows: HunterRow[] = [];
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
      const j = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
      for (const x of j.prompts ?? j.canaries ?? j.keys ?? []) if (x.prompt) rows.push({ src: f.replace(/\.json$/, ""), id: x.id ?? "", prompt: x.prompt });
    }
  } else rows.push(...JSON.parse(readFileSync(new URL("evals/hunter-corpus.json", root), "utf8")).prompts);
  const seen = new Set<string>();
  return rows.filter((r) => !seen.has(r.prompt) && !!seen.add(r.prompt));
}

/** Hunter hits keyed "check: what|prompt" (one per sub-check finding per prompt), with where each was found. */
export function hunterHits(rows: HunterRow[] = hunterCorpus()): Map<string, { src: string; where: string; match: string }> {
  const fetch0 = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;
  try {
    const out = new Map<string, { src: string; where: string; match: string }>();
    for (const r of rows) {
      let hits: { check: string; what: string; where: string }[];
      try { const p = generateFromPrompt(r.prompt); hits = hunt(p, buildPlan(p)); } catch (e) { hits = [{ check: "no-class", what: `build threw: ${String(e).slice(0, 60)}`, where: "model" }]; }
      for (const h of hits) {
        const what = h.what.replace(/ \(“.*$/, "");
        const k = `${h.check}: ${what}|${r.prompt}`;
        if (!out.has(k)) out.set(k, { src: r.src, where: h.where, match: h.what.match(/“(.*)”/)?.[1] ?? "" });
      }
    }
    return out;
  } finally {
    globalThis.fetch = fetch0;
  }
}
