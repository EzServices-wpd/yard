#!/usr/bin/env -S npx tsx
/**
 * Nightly error ranking (free, no xAI, no store writes). Runs every invariant (I1–I14 per build, I16 overlaps)
 * over the eval set, every built-in idea and learned recipe, the seeded sizes, and the live Ideas builds (one
 * read-only GET; skipped if offline). Live source, printed on every run:
 * - private: with CRITIC_REVIEW_SECRET in the env, the typed prompts from /api/critic-review?op=snapshot (the store's
 *   cleaned prompts, real wording such as stock words). Never on GitHub Actions: this repo is public, so its run
 *   logs and artifacts are too, and the report's Examples column would publish visitors' words.
 * - public (fallback): /api/ideas-snapshot serves build types and sizes, never typed prompts, so each live build is
 *   rebuilt from the prompt its Ideas card builds (liveFeed logCardPrompt).
 * Writes a ranked Markdown report and always exits 0.
 *   npm run rank-errors [-- --dir /path/dir] [-- --no-live]
 * Each run writes a dated copy (yard-errors-ranked-YYYY-MM-DD.md) plus yard-errors-ranked-latest.md; nothing is overwritten
 * except "latest", and dated copies past the store's RETAIN_DAYS are deleted (staleReports). Live Ideas rows from Critic's probes ("critic probe") are not user ideas and are left out.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { checkBuild, INVARIANT_CLASS, type InvariantId } from "../src/lib/yard/invariants.ts";
import { overlaps } from "../src/lib/yard/overlaps.ts";
import { offline } from "./eval-lib.ts";
import { EVAL_PROMPTS, corpus, seededSizes } from "./invariants-corpus.ts";
import { dimsOf, logCardPrompt } from "../src/lib/ideas/liveFeed.ts";
import { RETAIN_MS } from "../src/lib/yard/ideaLog.server.ts";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const DIR = arg("--dir") ?? "/workspace/yard-errors";

/** Report paths for a run: a dated copy that is never overwritten by a later day, plus the rolling latest. */
export function reportPaths(dir: string, now = new Date()): { dated: string; latest: string } {
  // F48: the date is New York's, so a run after 8 PM ET is not stamped tomorrow.
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return { dated: join(dir, `yard-errors-ranked-${day}.md`), latest: join(dir, "yard-errors-ranked-latest.md") };
}

/**
 * Dated reports older than the store's RETAIN_DAYS: a private run's Examples hold visitors' typed words, and the privacy
 * page says saved prompts go after 90 days, so every run deletes them (a public-only report goes too: one rule).
 */
export function staleReports(names: string[], now = new Date()): string[] {
  const cutoff = reportPaths("", new Date(now.getTime() - RETAIN_MS)).dated;
  return names.filter((n) => /^yard-errors-ranked-\d{4}-\d{2}-\d{2}\.md$/.test(n) && n < cutoff);
}

/** Critic's probe rows in the Ideas snapshot are test traffic, not ideas to rank. */
export const isProbe = (row: { prompt?: string; source?: string; tags?: unknown }) =>
  /critic[\s_-]*probe/i.test(`${row.prompt ?? ""} ${row.source ?? ""} ${JSON.stringify(row.tags ?? "")}`);
const SITE = "https://yard.wiki";

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

type Live = { prompts: string[]; note: string; source: "private" | "public" | "none" };
type Env = Record<string, string | undefined>;

/** The live Ideas builds: the private typed prompts when the secret is here (and not on Actions), else the public card builds. */
export async function liveIdeas(env: Env = process.env, get: typeof fetch = fetch, site = SITE): Promise<Live> {
  if (process.argv.includes("--no-live")) return { prompts: [], note: "skipped (--no-live)", source: "none" };
  let why = env.GITHUB_ACTIONS ? "not on GitHub Actions" : "no CRITIC_REVIEW_SECRET";
  if (env.CRITIC_REVIEW_SECRET && !env.GITHUB_ACTIONS) {
    try {
      const r = await get(`${site}/api/critic-review?op=snapshot`, { headers: { authorization: `Bearer ${env.CRITIC_REVIEW_SECRET}` }, signal: AbortSignal.timeout(10_000) });
      // A wrong secret is the app's not-found (HTML), never JSON rows: anything but 200 + rows falls back.
      const s = r.ok ? ((await r.json()) as { live?: boolean; rows?: { prompt?: unknown; source?: string; tags?: unknown }[] }) : null;
      if (s && Array.isArray(s.rows)) {
        const kept = s.rows.filter((x): x is typeof x & { prompt: string } => typeof x.prompt === "string" && !!x.prompt && !isProbe(x as { prompt: string }));
        const prompts = [...new Set(kept.map((x) => x.prompt))];
        return { prompts, source: "private", note: `private query log: ${prompts.length} typed prompts from ${kept.length} rows (live: ${s.live ? "yes" : "no"}; ${s.rows.length - kept.length} probe or malformed rows dropped; keep this report private)` };
      }
      why = `private read got ${r.status}`;
    } catch (e) {
      why = `private read failed (${String((e as Error)?.name ?? "error")})`;
    }
  }
  try {
    const r = await get(`${site}/api/ideas-snapshot`, { signal: AbortSignal.timeout(10_000) });
    // Fetched JSON is untrusted: a row counts only with a string build type (liveFeed PublicRow).
    const s = (await r.json()) as { live?: boolean; rows?: { buildType?: unknown; size?: unknown; source?: string; tags?: unknown }[] };
    const all = s.rows ?? [];
    const kept = all.filter((x): x is typeof x & { buildType: string } => !isProbe(x) && typeof x.buildType === "string" && !!x.buildType);
    const prompts = [...new Set(kept.map((x) => logCardPrompt(x.buildType, dimsOf(String(x.size ?? "")))))];
    return { prompts, source: "public", note: `public snapshot (${why}): ${prompts.length} card builds from ${kept.length} rows (live: ${s.live ? "yes" : "no"}; ${all.length - kept.length} probe or malformed rows dropped)` };
  } catch (e) {
    return { prompts: [], source: "none", note: `unavailable (${why}; ${String(e).slice(0, 60)})` };
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
  console.log(`rank-errors live Ideas source: ${live.source}: ${live.note}`);
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
  for (const n of staleReports(readdirSync(DIR))) rmSync(join(DIR, n));
  console.log(`wrote ${out.dated} and ${out.latest}: ${rows.length} classes, ${failing.size} failing builds of ${prompts.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => console.error("rank-errors: report failed but exits 0:", e)).finally(() => process.exit(0));
}
