#!/usr/bin/env -S npx tsx
/**
 * Nightly error ranking (free, no xAI, no store writes). Runs every invariant (I1–I14 per build, I16 overlaps)
 * over the eval set, every built-in idea and learned recipe, the seeded sizes, and the prompts in the live
 * Ideas snapshot (one read-only GET; skipped if offline). Writes a ranked Markdown report and always exits 0.
 *   npm run rank-errors [-- --dir /path/dir] [-- --no-live]
 * Each run writes a dated copy (yard-errors-ranked-YYYY-MM-DD.md) plus yard-errors-ranked-latest.md; nothing is overwritten
 * except "latest". Live Ideas rows from Critic's probes ("critic probe") are not user ideas and are left out.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { checkBuild, INVARIANT_CLASS, type InvariantId } from "../src/lib/yard/invariants.ts";
import { overlaps } from "../src/lib/yard/overlaps.ts";
import { offline } from "./eval-lib.ts";
import { EVAL_PROMPTS, corpus, seededSizes } from "./invariants-corpus.ts";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const DIR = arg("--dir") ?? "/workspace/yard-errors";

/** Report paths for a run: a dated copy that is never overwritten by a later day, plus the rolling latest. */
export function reportPaths(dir: string, now = new Date()): { dated: string; latest: string } {
  // F48: the date is New York's, so a run after 8 PM ET is not stamped tomorrow.
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return { dated: join(dir, `yard-errors-ranked-${day}.md`), latest: join(dir, "yard-errors-ranked-latest.md") };
}

/** Critic's probe rows in the Ideas snapshot are test traffic, not ideas to rank. */
export const isProbe = (row: { prompt?: string; source?: string; tags?: unknown }) =>
  /critic[\s_-]*probe/i.test(`${row.prompt ?? ""} ${row.source ?? ""} ${JSON.stringify(row.tags ?? "")}`);
const SNAPSHOT = "https://yard.wiki/api/ideas-snapshot";

/** Severity: wrong build / totals / hardware or overlaps matter more than wording. */
export const SEVERITY: Record<string, number> = { I1: 3, I3: 3, I9: 3, I13: 3, I16: 2, I4: 2, I8: 2, I14: 2, I7: 2, I6: 1, I11: 1, I12: 1 };
const sev = (id: string) => SEVERITY[id] ?? 1;

/** A failure class: the invariant plus its message with sizes, counts, letters and names folded out. */
export function classOf(id: string, msg: string): string {
  const m = msg
    // Part names are examples, not classes: "Left side reaches…" and "Base reaches…" are one class.
    .replace(/^[A-Z][\w\s'’-]*?(?= (?:reaches|is|are|spans|has|sits|overhangs|stands|floats|hangs)\b)/, "<part>")
    .replace(/\b(before|on|to|into|under|over) (?:the )?[A-Z][\w'’-]*(?: [a-z][\w'’-]*){0,3}?(?=,| which|$| \()/g, "$1 <part>")
    .replace(/"[^"]*"|'[^']*'|“[^”]*”/g, "…")
    .replace(/\b[A-Z]\b/g, "X")
    .replace(/\d+(?:[ .\/]\d+)*\s*(?:"|″|in\b|ft\b|')?/g, "N")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
  return `${id} · ${m}`;
}

async function liveIdeas(): Promise<{ prompts: string[]; note: string }> {
  if (process.argv.includes("--no-live")) return { prompts: [], note: "skipped (--no-live)" };
  try {
    const r = await fetch(SNAPSHOT, { signal: AbortSignal.timeout(10_000) });
    const s = (await r.json()) as { live?: boolean; rows?: { prompt: string; source?: string; tags?: unknown }[] };
    const all = s.rows ?? [];
    const kept = all.filter((x) => !isProbe(x));
    const prompts = [...new Set(kept.map((x) => x.prompt).filter((p) => typeof p === "string"))];
    return { prompts, note: `${prompts.length} prompts (live: ${s.live ? "yes" : "no"}; ${all.length - kept.length} critic probe rows dropped)` };
  } catch (e) {
    return { prompts: [], note: `unavailable (${String(e).slice(0, 60)})` };
  }
}

type Row = { cls: string; id: string; fclass: string; sev: number; builds: Set<string>; baselined: number; fresh: number; freshB: string[] };

export function rank(prompts: string[], base: Record<string, unknown>, overlapBase: Record<string, number>): Row[] {
  const rows = new Map<string, Row>();
  const add = (id: string, msg: string, q: string, known: boolean) => {
    const cls = classOf(id, msg);
    const r = rows.get(cls) ?? { cls, id, fclass: id === "I16" ? "F30" : INVARIANT_CLASS[id as InvariantId] ?? "?", sev: sev(id), builds: new Set<string>(), baselined: 0, fresh: 0, freshB: [] as string[] };
    if (!r.builds.has(q)) { r.builds.add(q); if (known) r.baselined++; else { r.fresh++; r.freshB.push(q); } }
    rows.set(cls, r);
  };
  offline(() => {
    for (const q of prompts) {
      let p;
      try { p = generateFromPrompt(q); } catch (e) { add("I1", `build threw: ${String(e).slice(0, 60)}`, q, `I1|${q}` in base); continue; }
      try { for (const v of checkBuild(p, q)) add(v.id, v.msg, q, `${v.id}|${q}` in base); } catch (e) { add("I1", `check threw: ${String(e).slice(0, 60)}`, q, false); }
      try {
        const o = overlaps(p);
        if (o.length) add("I16", `parts overlap with no modelled joint`, q, (overlapBase[q] ?? 0) >= o.length);
      } catch { /* shaped builds: judged elsewhere */ }
    }
  });
  return [...rows.values()].sort((a, b) => b.builds.size * b.sev - a.builds.size * a.sev || b.fresh - a.fresh || a.cls.localeCompare(b.cls));
}

async function main() {
  const live = await liveIdeas();
  const sets = { eval: EVAL_PROMPTS.length, seeded: seededSizes().length, corpus: corpus().length };
  const prompts = [...new Set([...corpus(), ...live.prompts])];
  const base = JSON.parse(readFileSync(new URL("../evals/invariants-baseline.json", import.meta.url), "utf8")).known as Record<string, unknown>;
  const ob = JSON.parse(readFileSync(new URL("../evals/overlap-baseline.json", import.meta.url), "utf8")).known as Record<string, number>;
  const t = Date.now();
  const rows = rank(prompts, base, ob);
  const failing = new Set(rows.flatMap((r) => [...r.builds]));
  const md = [
    `# Yard errors, ranked — ${new Date().toISOString()}`,
    "",
    `Builds checked: ${prompts.length} (eval ${sets.eval}, corpus incl. ideas/recipes/seeded ${sets.corpus}, seeded sizes ${sets.seeded}, live Ideas ${live.note}). No xAI calls, no store writes. ${Math.round((Date.now() - t) / 1000)} s.`,
    `Failing builds: ${failing.size}. Classes: ${rows.length}. New (not baselined) build-failures: ${rows.reduce((n, r) => n + r.fresh, 0)}.`,
    "",
    "Rank = builds × severity (I1/I3/I9/I13 = 3; I4/I7/I8/I14/I16 = 2; others 1).",
    "",
    "| # | Class | F# | Builds | Sev | Score | Baselined | New | Examples |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r, i) => `| ${i + 1} | ${r.cls.replace(/\|/g, "/")} | ${r.fclass} | ${r.builds.size} | ${r.sev} | ${r.builds.size * r.sev} | ${r.baselined} | ${r.fresh} | ${[...new Set([...r.freshB.map((b) => `NEW: ${b}`), ...[...r.builds].filter((b) => !r.freshB.includes(b))])].slice(0, 3).map((b) => b.replace(/\|/g, "/").slice(0, 50)).join("; ")} |`),
    "",
  ].join("\n");
  const out = reportPaths(DIR);
  mkdirSync(DIR, { recursive: true });
  writeFileSync(out.dated, md);
  writeFileSync(out.latest, md);
  console.log(`wrote ${out.dated} and ${out.latest}: ${rows.length} classes, ${failing.size} failing builds of ${prompts.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => console.error("rank-errors: report failed but exits 0:", e)).finally(() => process.exit(0));
}
