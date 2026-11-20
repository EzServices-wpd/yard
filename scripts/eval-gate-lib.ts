/**
 * Eval gate core: engine-direct (no browser, network off), one build per corpus prompt, graded pass/partial/fail
 * from the deterministic invariants (src/lib/yard/invariants.ts, known violations read from
 * evals/invariants-baseline.json) and the typed-word honor check (ported from /workspace/grok-intake-ab).
 *
 * The engine is imported from a root directory, never statically, so CI can grade the PR head and its
 * merge-base main with the same corpus and the same grader: `--root <checkout>` (run with that checkout as cwd
 * so its tsconfig resolves its own "@/..." imports).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { typedDemands, validateSpec, type Demands } from "./eval-gate-typed.ts";
import { type Refusal } from "./eval-gate-refusal.ts";
import { isTestTraffic, type LoggedRecord } from "../src/lib/ideas/testTraffic.ts";
import { REPORT_ONLY_IDS, projectGrade, r16, r2, type AnswerKey, type Grade, type HonorItem } from "../src/lib/yard/gateGrade.ts";
export { FAIL_INVARIANTS, GRADE_RANK, REPORT_ONLY_IDS, gradeOf, honor, projectGrade, r16, shelfLevelCount, type AnswerKey, type Grade, type HonorItem } from "../src/lib/yard/gateGrade.ts";

export const HEAD_ROOT = resolve(new URL("..", import.meta.url).pathname);

export function loadExpectedRefusals(root: string) {
  const f = join(root, "evals/expected-refusals.json");
  return (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")).refusals : {}) as import("./eval-gate-refusal.ts").ExpectedRefusals;
}

/**
 * The only checkBuild IDs that are listed without grading: geometry-quality checks that ratchet in
 * evals/invariants-baseline.json and stay out of PER_BUILD (row 181). Every other ID grades, including every PER_BUILD ID
 * (the set scripts/eval-score.ts counts) and the typed-word hard rules outside it (Critic #110 B1): requested drawers built
 * (I31), typed size built (I35), typed count built or refused (I36), too-small size refused (I38). A new ID grades unless
 * it is added here, so loosening is always an explicit edit to a gate file.
 */
export const TYPED_RULE_IDS = ["I31", "I35", "I36", "I38"] as const;
export type Engine = {
  root: string;
  /** The engine's own stand-in marks, read by the honest checks; absent on an older tree. */
  genericFormMark?: (p: any) => string | null;
  genericBoxOverAsk?: (prompt: string, p: any) => boolean;
  generateFromPrompt: (q: string) => any;
  ignoredTypedWords: (p: any, q: string) => string[];
  checkBuild: (p: any, q: string, plan?: any) => { id: string; cls: string; msg: string }[];
  buildPlan: (p: any) => any;
  headerTitle: (p: any) => string;
  POCKET_DREAM: string;
  baseline: Record<string, { class: string; msg: string }>;
  /** Whether a checkBuild ID grades: everything but REPORT_ONLY_IDS (asserted to cover the root's PER_BUILD in eval-gate.test.ts). */
  graded: (id: string) => boolean;
  /** evals/expected-refusals.json from the head (like the canary baselines): the same expectations grade head and base. */
  refusals: ExpectedRefusals;
};
export async function loadEngine(root = HEAD_ROOT): Promise<Engine> {
  const y = (f: string) => pathToFileURL(join(root, "src/lib/yard", f)).href;
  const [pm, inv, rep, pdf, pocket] = await Promise.all([import(y("promptMain.ts")), import(y("invariants.ts")), import(y("report.ts")), import(y("pdf.ts")), import(y("pocket.ts"))]);
  const bf = join(root, "evals/invariants-baseline.json");
  const baseline = existsSync(bf) ? JSON.parse(readFileSync(bf, "utf8")).known : {};
  // The honest checks (scripts/eval-gate-honest.ts) read the engine's own stand-in marks; an older tree may lack them.
  const fo = await import(y("formOwnership.ts")).catch(() => ({}));
  const gb = await import(y("genericBox.ts")).catch(() => ({}));
  return { root, generateFromPrompt: pm.generateFromPrompt, ignoredTypedWords: pm.ignoredTypedWords ?? (() => []), checkBuild: inv.checkBuild, buildPlan: rep.buildPlan, headerTitle: pdf.headerTitle, POCKET_DREAM: pocket.POCKET_DREAM, baseline, graded: (id: string) => !REPORT_ONLY_IDS.has(id), refusals: loadExpectedRefusals(HEAD_ROOT), genericFormMark: (fo as any).genericFormMark, genericBoxOverAsk: (gb as any).genericBoxOverAsk };
}
/** Same rule as scripts/eval-lib.ts: evals never touch the network (no xAI, no stores). */
export function offline<T>(f: () => T): T {
  const real = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error("no network: the eval gate never calls xAI or any API"); }) as typeof fetch;
  try { return f(); } finally { globalThis.fetch = real; }
}

// ---------------------------------------------------------------- corpus
export type CorpusItem = { id?: string; prompt: string; spec?: unknown; demandsFrom?: string; expect?: AnswerKey; walkGrade?: string; note?: string };
export type CorpusFile = { source: string; note?: string; prompts: CorpusItem[] };
export type Entry = { prompt: string; sources: string[]; ids: string[]; demands: Demands; demandsFrom: string; expect?: AnswerKey };
export const norm = (q: string) => q.replace(/\s+/g, " ").trim();
/** Graded on their own: canaries (hard fail) and answer keys (report only, scripts/eval-gate-keys.ts). */
export const NOT_PROMPT_FILES = new Set(["canaries.json", "answer-keys.json"]);
/** Every prompt corpus file in evals/corpus, plus evals/prompts.json (the frozen scoreboard set). */
export function loadCorpus(dir = join(HEAD_ROOT, "evals/corpus")): Entry[] {
  const files: CorpusFile[] = readdirSync(dir).filter((f) => f.endsWith(".json") && !NOT_PROMPT_FILES.has(f)).sort().map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  const ev = JSON.parse(readFileSync(join(HEAD_ROOT, "evals/prompts.json"), "utf8")).prompts as string[];
  files.unshift({ source: "eval46", note: "evals/prompts.json (the frozen scoreboard set)", prompts: ev.map((prompt) => ({ prompt })) });
  const byPrompt = new Map<string, Entry>();
  for (const f of files) {
    for (const it of f.prompts) {
      const q = norm(it.prompt);
      if (!q) continue;
      const spec = it.spec ? validateSpec(it.spec, q) : null;
      const e = byPrompt.get(q);
      if (e) {
        if (!e.sources.includes(f.source)) e.sources.push(f.source);
        if (it.id && !e.ids.includes(it.id)) e.ids.push(it.id);
        if (spec?.head_noun && e.demandsFrom === "typed-rules") { e.demands = spec; e.demandsFrom = it.demandsFrom ?? "spec"; }
        if (it.expect) e.expect = { ...e.expect, ...it.expect };
        continue;
      }
      const demands = spec?.head_noun ? spec : typedDemands(q);
      byPrompt.set(q, { prompt: q, sources: [f.source], ids: it.id ? [it.id] : [], demands, demandsFrom: spec?.head_noun ? it.demandsFrom ?? "spec" : "typed-rules", expect: it.expect });
    }
  }
  return [...byPrompt.values()].sort((a, b) => (a.prompt < b.prompt ? -1 : a.prompt > b.prompt ? 1 : 0));
}

// ---------------------------------------------------------------- corpus removals (a PR may not drop a prompt to pass)
/**
 * Every prompt a checkout's corpus grades, by normalized text → the files that hold it: each evals/corpus/*.json
 * (prompt files, canaries and answer keys alike) plus evals/prompts.json. Read from that checkout's own files, so CI
 * can compare main's corpus (the merge-base) with the PR's, independent of which corpus the grader ran on.
 */
export function corpusPrompts(root = HEAD_ROOT): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (q: unknown, file: string) => { if (typeof q !== "string" || !norm(q)) return; const k = norm(q); const f = out.get(k) ?? []; if (!f.includes(file)) f.push(file); out.set(k, f); };
  const dir = join(root, "evals/corpus");
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => `evals/corpus/${f}`) : [];
  if (existsSync(join(root, "evals/prompts.json"))) files.push("evals/prompts.json");
  for (const file of files) {
    const j = JSON.parse(readFileSync(join(root, file), "utf8"));
    for (const it of [...(j.prompts ?? []), ...(j.canaries ?? []), ...(j.keys ?? [])]) add(typeof it === "string" ? it : it?.prompt, file);
  }
  return out;
}
export type RemovalAllow = { removals?: { prompt: string; reason: string }[] };
export type Removal = { prompt: string; files: string[]; allowed: string | null };
/** Prompts in the base corpus that the head corpus no longer has; each is allowed only with a non-empty reason. */
export function corpusRemovals(base: Map<string, string[]>, head: Map<string, string[]> | Set<string>, allow: RemovalAllow = {}): Removal[] {
  const reasons = new Map((allow.removals ?? []).filter((a) => typeof a?.reason === "string" && a.reason.trim() && typeof a.prompt === "string").map((a) => [norm(a.prompt), a.reason.trim()]));
  return [...base].filter(([q]) => !head.has(q)).map(([q, files]) => ({ prompt: q, files, allowed: reasons.get(q) ?? null })).sort((a, b) => (a.prompt < b.prompt ? -1 : 1));
}

// Honor, shelf counts and gradeOf live in src/lib/yard/gateGrade.ts so the learner's keep decision
// grades with this exact function. r16 and r2 are re-exported from there.
export type PromptResult = {
  prompt: string; sources: string[]; ids: string[]; grade: Grade; classes: string[];
  header: string | null; overall: string | null; pieces: number | null; usd: number | null;
  honor: { honored: number; checkable: number; demandsFrom: string; items: HonorItem[] };
  /** Every checkBuild hit. scored = graded (not in REPORT_ONLY_IDS); a geometry report-only hit is listed but never grades. */
  invariants: { id: string; cls: string; msg: string; known: boolean; scored: boolean }[];
  /** Honest-gate hits (H-standin, H-craft): each is a hard fail. */
  honest?: { cls: string; msg: string }[];
  /** Set when the build refused or was expected to: honest = graded pass, otherwise X-refusal (eval-gate-refusal.ts). */
  refusal?: Refusal;
  error?: string;
};
export function gradeOne(E: Engine, e: Entry): PromptResult {
  return offline(() => {
    const base = { prompt: e.prompt, sources: e.sources, ids: e.ids };
    let p: any, plan: any;
    try { p = E.generateFromPrompt(e.prompt); plan = E.buildPlan(p); } catch (err) {
      const items: HonorItem[] = e.demands.head_noun ? [{ demand: `noun "${e.demands.head_noun.quote}"`, kind: "noun", ok: false, shows: "build threw" }] : [];
      return { ...base, grade: "fail", classes: ["X-build"], header: null, overall: null, pieces: null, usd: null, honor: { honored: 0, checkable: Math.max(1, items.length), demandsFrom: e.demandsFrom, items }, invariants: [], error: String(err).slice(0, 160) };
    }
    // Same function the learner's keep decision calls, so a saved recipe cannot grade worse than this row.
    return { ...base, ...projectGrade(E, e, p, plan, e.prompt) };
  });
}

// ---------------------------------------------------------------- canaries (hard fail, separate from the totals)
export type Canary = { id: string; prompt: string; dream?: "POCKET_DREAM"; header?: string; pieces?: number; usd?: number; overall?: [number, number, number]; checks?: string[]; /** Repo path of a byte-exact plan baseline (scripts/baselines/*.txt): the whole printed plan must match. */ baseline?: string; why: string };
/** The printed plan exactly as scripts/linen-check.ts prints it: name, size, parts; Buy names; every step. */
export function planText(p: any, plan: any): string {
  return [
    `${p.name} ${JSON.stringify(p.overall)} ${p.panels.map((x: any) => x.name).join("; ")}`,
    plan.bom.map((b: any) => b.name).join(", "),
    plan.instructions.map((s: any) => `${s.title}: ${s.description}`).join("\n"),
  ].join("\n") + "\n";
}
/** First line where the plan differs from its baseline, or null when byte-identical. */
export function baselineDiff(now: string, base: string): string | null {
  if (now === base) return null;
  const a = now.split("\n"), b = base.split("\n");
  const i = a.findIndex((l, k) => l !== b[k]);
  const at = i < 0 ? Math.min(a.length, b.length) : i;
  const x = a[at] ?? "<end>", y = b[at] ?? "<end>";
  let c = 0;
  while (c < x.length && x[c] === y[c]) c++;
  const from = Math.max(0, c - 30);
  return `plan differs from the baseline at line ${at + 1}: "…${x.slice(from, c + 50)}" ≠ "…${y.slice(from, c + 50)}"`;
}
export type CanaryResult = { id: string; prompt: string; ok: boolean; failures: string[]; got: { header: string | null; pieces: number | null; usd: number | null; overall: string | null } };
const CHECKS: Record<string, (p: any, plan: any) => string | null> = {
  pocket: (p) => (!p.pocket ? "no project.pocket (trapezoid spec)" : p.overall.height < 90 || p.panels.length < 10 ? `lost the trapezoid (H ${p.overall.height}, ${p.panels.length} panels)` : !/trapezoid/i.test(JSON.stringify(p.pocket)) && !/16(\.\d+)?\s*°|trapezoid/i.test([p.name, ...(p.notes ?? [])].join(" ")) ? "trapezoid angles gone" : null),
  opening: (p) => (p.kind !== "opening" ? `kind ${p.kind} ≠ opening` : !/Andersen/i.test(p.name) ? `name "${p.name}" lost Andersen` : null),
  knee: (_p, plan) => (!plan.instructions.some((s: any) => /knee/i.test(`${s.title} ${s.description}`)) ? "plan lost the 24\" knee bay" : null),
  "eiffel-sticks": (p) => (p.kind !== "eiffel" ? `kind ${p.kind} ≠ eiffel (craft lost)` : p.panels.some((x: any) => x.type === "deck") || p.instances.some((i: any) => i.role === "deck") ? "Eiffel picked up a road" : p.instances.length < 400 || p.instances.length > 1200 ? `stick count ${p.instances.length} outside 400–1200` : !/popsicle|craft/i.test(p.primaryMaterialId ?? "") ? `stock ${p.primaryMaterialId} is not popsicle` : null),
  "platform-tower": (p) => (p.shape?.classId !== "platform-tower" ? `shape ${p.shape?.classId} ≠ platform-tower` : null),
  tread: (p) => {
    if (!p.climb) return "not the climb panel model";
    const treads = p.panels.filter((x: any) => x.type === "top" && /tread/i.test(x.name));
    if (!treads.length) return "no tread";
    const d = Math.max(...treads.map((t: any) => Math.max(t.size.depth, t.size.width)));
    return d < 10 ? `tread only ${d}"` : null;
  },
};
export function gradeCanary(E: Engine, c: Canary): CanaryResult {
  return offline(() => {
    const q = c.dream === "POCKET_DREAM" ? E.POCKET_DREAM : c.prompt;
    const failures: string[] = [];
    let p: any, plan: any;
    try { p = E.generateFromPrompt(q); plan = E.buildPlan(p); } catch (err) {
      return { id: c.id, prompt: c.prompt, ok: false, failures: [`build threw: ${String(err).slice(0, 100)}`], got: { header: null, pieces: null, usd: null, overall: null } };
    }
    let header: string | null = null;
    try { header = E.headerTitle(p); } catch { /* none */ }
    const pieces = plan.totals.pieces as number, usd = r2(plan.totals.estCostUsd);
    if (c.header != null && header !== c.header) failures.push(`header "${header}" ≠ "${c.header}"`);
    if (c.pieces != null && pieces !== c.pieces) failures.push(`${pieces} parts ≠ ${c.pieces}`);
    if (c.usd != null && Math.abs(usd - c.usd) > 0.005) failures.push(`$${usd.toFixed(2)} ≠ $${c.usd.toFixed(2)}`);
    const buy = r2(plan.bom.reduce((t: number, b: any) => t + (b.estimatedCost ?? 0), 0));
    if (Math.abs(buy - plan.totals.estCostUsd) > 0.02) failures.push(`total $${usd} ≠ Buy $${buy}`);
    const o = p.overall;
    if (c.overall && [o.width, o.depth, o.height].some((v: number, i: number) => Math.abs(v - c.overall![i]) > 1 / 16)) failures.push(`size ${r16(o.width)}×${r16(o.depth)}×${r16(o.height)} ≠ ${c.overall.join("×")}`);
    for (const k of c.checks ?? []) { const f = CHECKS[k]?.(p, plan) ?? (CHECKS[k] ? null : `unknown check ${k}`); if (f) failures.push(f); }
    // The whole printed plan (heights, gaps, every step), byte for byte: the head's committed baseline, never the base's.
    if (c.baseline) {
      const bf = join(HEAD_ROOT, c.baseline);
      const d = existsSync(bf) ? baselineDiff(planText(p, plan), readFileSync(bf, "utf8")) : `baseline ${c.baseline} missing`;
      if (d) failures.push(d);
    }
    return { id: c.id, prompt: c.prompt, ok: !failures.length, failures, got: { header, pieces, usd, overall: `${r16(o.width)}W × ${r16(o.depth)}D × ${r16(o.height)}H` } };
  });
}
export function loadCanaries(dir = join(HEAD_ROOT, "evals/corpus")): Canary[] {
  return JSON.parse(readFileSync(join(dir, "canaries.json"), "utf8")).canaries;
}

// ---------------------------------------------------------------- totals
export type Totals = { prompts: number; pass: number; partial: number; fail: number; points: number; maxPoints: number; honored: number; checkable: number; honorPct: number };
export function totalsOf(rows: PromptResult[]): Totals {
  const g = { pass: 0, partial: 0, fail: 0 };
  for (const r of rows) g[r.grade]++;
  const honored = rows.reduce((t, r) => t + r.honor.honored, 0), checkable = rows.reduce((t, r) => t + r.honor.checkable, 0);
  return { prompts: rows.length, ...g, points: 2 * g.pass + g.partial, maxPoints: 2 * rows.length, honored, checkable, honorPct: checkable ? Math.round((1000 * honored) / checkable) / 10 : 100 };
}
export function byClass(rows: PromptResult[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) for (const c of r.classes) m[c] = (m[c] ?? 0) + 1;
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)));
}
export function bySource(rows: PromptResult[]): Record<string, Totals> {
  const s = [...new Set(rows.flatMap((r) => r.sources))].sort();
  return Object.fromEntries(s.map((k) => [k, totalsOf(rows.filter((r) => r.sources.includes(k)))]));
}
/** Stable JSON: keys in insertion order (built deterministically), prompts sorted, 1-space indent like evals/score.json. */
export const stable = (x: unknown) => JSON.stringify(x, null, 1) + "\n";

/**
 * Test traffic never enters the corpus. It is decided by the real signals in the logged record — the `test=1` query
 * flag on the logged URL and the `x-yard-test: 1` request header — never by the prompt text, so a real "test tube rack"
 * is kept. One helper for the app and the gate: src/lib/ideas/testTraffic.ts (the Ideas live feed uses it too).
 */
export { isTestTraffic, type LoggedRecord } from "../src/lib/ideas/testTraffic.ts";
/** Drop logged test traffic and case-insensitive duplicates (first wins); strips the record so it never lands in the corpus. */
export function keepCorpusRows<T extends { prompt: string; rec?: LoggedRecord | null }>(rows: T[]): Omit<T, "rec">[] {
  const seen = new Set<string>();
  return rows.filter((w) => w.prompt && !isTestTraffic(w.rec) && !seen.has(w.prompt.toLowerCase()) && seen.add(w.prompt.toLowerCase())).map(({ rec: _rec, ...w }) => w);
}
