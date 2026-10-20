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

export const HEAD_ROOT = resolve(new URL("..", import.meta.url).pathname);

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Engine = {
  root: string;
  generateFromPrompt: (q: string) => any;
  ignoredTypedWords: (p: any, q: string) => string[];
  checkBuild: (p: any, q: string, plan?: any) => { id: string; cls: string; msg: string }[];
  buildPlan: (p: any) => any;
  headerTitle: (p: any) => string;
  POCKET_DREAM: string;
  baseline: Record<string, { class: string; msg: string }>;
};
export async function loadEngine(root = HEAD_ROOT): Promise<Engine> {
  const y = (f: string) => pathToFileURL(join(root, "src/lib/yard", f)).href;
  const [pm, inv, rep, pdf, pocket] = await Promise.all([import(y("promptMain.ts")), import(y("invariants.ts")), import(y("report.ts")), import(y("pdf.ts")), import(y("pocket.ts"))]);
  const bf = join(root, "evals/invariants-baseline.json");
  const baseline = existsSync(bf) ? JSON.parse(readFileSync(bf, "utf8")).known : {};
  return { root, generateFromPrompt: pm.generateFromPrompt, ignoredTypedWords: pm.ignoredTypedWords ?? (() => []), checkBuild: inv.checkBuild, buildPlan: rep.buildPlan, headerTitle: pdf.headerTitle, POCKET_DREAM: pocket.POCKET_DREAM, baseline };
}
/** Same rule as scripts/eval-lib.ts: evals never touch the network (no xAI, no stores). */
export function offline<T>(f: () => T): T {
  const real = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error("no network: the eval gate never calls xAI or any API"); }) as typeof fetch;
  try { return f(); } finally { globalThis.fetch = real; }
}

// ---------------------------------------------------------------- corpus
export type AnswerKey = { width?: number; depth?: number; height?: number; pieces?: number; usd?: number; counts?: Record<string, number>; name?: string };
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

// ---------------------------------------------------------------- honor (ported from grok-intake-ab/engine.ts honor)
const lc = (s: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const r2 = (n: number) => Math.round(n * 100) / 100;
export const r16 = (n: number) => Math.round(n * 16) / 16;
const FEAT: [RegExp, RegExp][] = [
  [/rolling|caster|wheel/, /caster|wheel/], [/storage/, /lid|drawer|door|shelf|bin|box|storage|compartment/], [/dovetail/, /dovetail/], [/vise/, /vise/],
  [/wall/, /wall|cleat|hang|mount/], [/fold/, /fold|hinge/], [/door/, /door/], [/drawer/, /drawer/], [/shel/, /shelf|shelves/], [/lid/, /lid/],
  [/outdoor/, /outdoor|exterior|cedar|treated|2x6|weather/], [/covered/, /roof|cover/], [/black/, /black|paint/],
];
const COUNT: Record<string, RegExp> = { drawers: /^drawer front\b/i, doors: /\bdoor\b(?!\s*stop)/i, shelves: /^(?:adjustable |fixed |bottom |top |lower |middle )?shel(f|ves)\b(?!\s*pin)/i, steps: /\b(step|tread)\b/i, bins: /\bbin\b/i, legs: /\bleg\b/i, rods: /\brod\b/i, seats: /\bseat\b/i };
const MAT: [RegExp, RegExp][] = [[/popsicle|craft/, /popsicle|craft stick/], [/pvc/, /pvc/], [/cardboard/, /cardboard/], [/walnut/, /walnut/], [/cedar/, /cedar/], [/2x4/, /2x4|2×4/], [/1x6/, /1x6|1×6/], [/plywood/, /plywood/],
  // Added to the port: the named-species words the engine sells (named lumber species, C16).
  [/\boak\b/, /\boak\b/], [/maple/, /maple/], [/\bpine\b/, /\bpine\b/], [/cherry/, /cherry/], [/birch/, /birch/], [/poplar/, /poplar/], [/redwood/, /redwood/], [/\bmdf\b/, /\bmdf\b/], [/bamboo/, /bamboo/]];
export type HonorItem = { demand: string; kind: "noun" | "size" | "count" | "feature" | "budget" | "material" | "key"; ok: boolean | "disclosed"; shows: string };
export function honor(E: Engine, s: Demands, p: any, plan: any, builtFrom: string, expect?: AnswerKey) {
  const names: string[] = p.panels.map((x: any) => x.name);
  const text = lc([p.name, ...names, ...plan.bom.map((b: any) => b.name), ...(p.notes ?? []), ...plan.instructions.map((i: any) => i.title), p.primaryMaterialId, ...plan.cutList.map((c: any) => c.material)].join(" | "));
  const items: HonorItem[] = [];
  const empty = (!p.panels.length && !(p.instances ?? []).length) || !!p.displayOnly;
  let nounOk = !empty;
  if (s.head_noun) {
    const GENERIC = /^(model|replica|skeleton|set|boards?|a|an|the|of|simple|small|big|pair)$/;
    const ws = lc(s.head_noun.value).split(/[^a-z]+/).filter((w) => w && !GENERIC.test(w));
    const hw = ws.pop() ?? lc(s.head_noun.value).split(/[^a-z]+/).filter(Boolean).pop() ?? "";
    const stem0 = hw.replace(/(es|s)$/, "").slice(0, 6);
    const stem = stem0 === "booksh" ? "book" : stem0;
    let ign: string[] = [];
    try { ign = E.ignoredTypedWords(p, builtFrom); } catch { /* older engines */ }
    // The engine's own kind word counts as the noun ("linen closet" → kind closet, header "Linen").
    nounOk = (!empty && (lc(p.name ?? "").includes(stem) || (stem.length >= 4 && lc(p.kind ?? "").startsWith(stem)))) || (!empty && !p.standIn && !p.unmatched && !ign.some((w) => w.startsWith(stem.slice(0, 4))) && text.includes(stem));
    items.push({ demand: `noun "${s.head_noun.quote}"`, kind: "noun", ok: nounOk, shows: empty ? "no build" : p.name });
  }
  const o = p.overall;
  const tol = (v: number) => Math.max(1, v > 48 ? v * 0.02 : 0.5);
  // A framed window or door: the typed size is the unit in the opening, not the framing around it.
  const unit = p.opening && /^(?:window|door)$/.test(p.opening.kind ?? "") ? p.opening : null;
  // "82 long 44 wide": with a length typed, width and length are the two plan axes, in either order.
  const planar = s.sizes.some((z) => z.axis === "L");
  for (const z of s.sizes) {
    const near = (g: number) => Math.abs(g - z.value_in) <= tol(z.value_in);
    const dims: number[] = unit ? [unit.width, unit.height, unit.depth] : [o.width, o.depth, o.height];
    const got = unit ? null : planar && (z.axis === "W" || z.axis === "L") ? null : z.axis === "W" ? o.width : z.axis === "D" ? o.depth : z.axis === "H" ? o.height : null;
    const ok = got != null ? near(got) : (planar && !unit && (z.axis === "W" || z.axis === "L") ? [o.width, o.depth] : dims).some(near);
    items.push({ demand: `size "${z.quote}" ${z.axis}=${r16(z.value_in)}`, kind: "size", ok: !empty && ok, shows: `${r2(o.width)}W×${r2(o.depth)}D×${r2(o.height)}H` });
  }
  for (const c of s.counts) {
    const re = COUNT[c.thing];
    if (!re) continue;
    let n = names.filter((x) => re.test(x)).length;
    // Drawer parts are not drawers: one drawer = one front ("Left drawer front 2"). Steps are treads when the model has treads.
    if (c.thing === "drawers") n = names.filter((x) => /\bdrawer front\b/i.test(x)).length;
    if (c.thing === "steps") { const t = names.filter((x) => /^(?:top )?tread\b/i.test(x)).length; if (t) n = t; }
    if (c.thing === "drawers" && n === 0) n = names.filter((x) => /^drawer\b/i.test(x) && !/slide|pull|bottom|side|back|front/i.test(x)).length;
    if (c.thing === "doors") n = names.filter((x) => re.test(x) && !/hinge|pull|stop|frame|rail|stile|panel/i.test(x)).length;
    if (c.thing === "bins" && n === 0) { const m = text.match(new RegExp(`\\b${c.n} (bins|bags|baskets|compartments)\\b`)); if (m) n = c.n; }
    const refused = typeof p.refused === "string" && p.refused.length > 0;
    items.push({ demand: `count "${c.quote}" ${c.thing}=${c.n}`, kind: "count", ok: n === c.n ? true : refused ? "disclosed" : false, shows: refused ? `refused: ${String(p.refused).slice(0, 60)}` : `${n} ${c.thing}` });
  }
  for (const f of s.features) {
    const m = FEAT.find(([k]) => k.test(lc(f.value)));
    if (!m) continue;
    const hit = m[1].test(text);
    const said = new RegExp(`${lc(f.value).slice(0, 5)}[^|]*(not (yet )?(supported|built|drawn|included)|isn't|is not)`).test(text);
    items.push({ demand: `feature "${f.quote}"`, kind: "feature", ok: hit ? true : said ? "disclosed" : false, shows: hit ? "present" : said ? "noted as not supported" : "absent" });
  }
  if (s.budget?.max_usd != null) items.push({ demand: `budget "${s.budget.quote}"`, kind: "budget", ok: plan.totals.estCostUsd <= s.budget.max_usd, shows: `$${r2(plan.totals.estCostUsd)}` });
  for (const m of [...s.material, ...s.finish]) {
    const k = MAT.find(([a]) => a.test(lc(m.value))) ?? (/(black|white)/.test(lc(m.value)) ? ([/./, new RegExp(lc(m.value).match(/black|white/)![0] + "|paint")] as [RegExp, RegExp]) : null);
    if (!k) continue;
    items.push({ demand: `material "${m.quote}"`, kind: "material", ok: k[1].test(text), shows: p.primaryMaterialId });
  }
  if (expect) {
    const near = (a: number, b: number, e: number) => Math.abs(a - b) <= e;
    if (expect.width != null) items.push({ demand: `key W=${expect.width}`, kind: "key", ok: near(o.width, expect.width, 1 / 16), shows: `${r16(o.width)}` });
    if (expect.depth != null) items.push({ demand: `key D=${expect.depth}`, kind: "key", ok: near(o.depth, expect.depth, 1 / 16), shows: `${r16(o.depth)}` });
    if (expect.height != null) items.push({ demand: `key H=${expect.height}`, kind: "key", ok: near(o.height, expect.height, 1 / 16), shows: `${r16(o.height)}` });
    if (expect.pieces != null) items.push({ demand: `key pieces=${expect.pieces}`, kind: "key", ok: plan.totals.pieces === expect.pieces, shows: `${plan.totals.pieces}` });
    if (expect.usd != null) items.push({ demand: `key $${expect.usd}`, kind: "key", ok: near(plan.totals.estCostUsd, expect.usd, 0.02), shows: `$${r2(plan.totals.estCostUsd)}` });
    if (expect.name != null) items.push({ demand: `key name ${expect.name}`, kind: "key", ok: lc(p.name).includes(lc(expect.name)), shows: p.name });
    for (const [thing, n] of Object.entries(expect.counts ?? {})) {
      const re = COUNT[thing];
      if (re) items.push({ demand: `key ${thing}=${n}`, kind: "key", ok: names.filter((x) => re.test(x)).length === n, shows: `${names.filter((x) => re.test(x)).length}` });
    }
  }
  return { items, nounOk, empty };
}

// ---------------------------------------------------------------- grading
/** Same weights as scripts/rank-errors.ts SEVERITY: a build that floats, miscounts, misses hardware or rots outdoors is a fail. */
export const FAIL_INVARIANTS = new Set(["I1", "I3", "I9", "I13"]);
export type Grade = "pass" | "partial" | "fail";
export type PromptResult = {
  prompt: string; sources: string[]; ids: string[]; grade: Grade; classes: string[];
  header: string | null; overall: string | null; pieces: number | null; usd: number | null;
  honor: { honored: number; checkable: number; demandsFrom: string; items: HonorItem[] };
  invariants: { id: string; cls: string; msg: string; known: boolean }[];
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
    let vs: { id: string; cls: string; msg: string }[] = [];
    try { vs = E.checkBuild(p, e.prompt, plan); } catch (err) { vs = [{ id: "I1", cls: "F1", msg: `checkBuild threw: ${String(err).slice(0, 80)}` }]; }
    const seen = new Set<string>();
    const invariants = vs.filter((x) => { const k = `${x.id}|${x.msg}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((x) => ({ id: x.id, cls: x.cls, msg: x.msg, known: `${x.id}|${e.prompt}` in E.baseline }))
      .sort((a, b) => (a.id + a.msg < b.id + b.msg ? -1 : 1));
    const h = honor(E, e.demands, p, plan, e.prompt, e.expect);
    const honored = h.items.filter((i) => i.ok === true).length;
    const checkable = h.items.length;
    const classes = new Set<string>();
    if (h.empty) classes.add("X-build");
    for (const v of invariants) classes.add(v.cls);
    for (const i of h.items) if (i.ok !== true) classes.add(`T-${i.kind}`);
    const severe = invariants.some((v) => FAIL_INVARIANTS.has(v.id));
    const grade: Grade = h.empty || !h.nounOk || severe ? "fail" : invariants.length || honored < checkable ? "partial" : "pass";
    let header: string | null = null;
    try { header = E.headerTitle(p); } catch { /* no header */ }
    const o = p.overall;
    return { ...base, grade, classes: [...classes].sort(), header, overall: o ? `${r16(o.width)}W × ${r16(o.depth)}D × ${r16(o.height)}H` : null, pieces: plan.totals.pieces, usd: r2(plan.totals.estCostUsd), honor: { honored, checkable, demandsFrom: e.demandsFrom, items: h.items }, invariants };
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
 * flag on the logged URL and the `x-yard-test: 1` request header (src/lib/ideas/testSession.ts) — never by the prompt
 * text, so a real "test tube rack" is kept. A row with no logged record is not test traffic.
 */
export type LoggedRecord = { url?: string; u?: string; headers?: Record<string, string | string[] | undefined> };
export function isTestTraffic(rec: LoggedRecord | null | undefined): boolean {
  if (!rec) return false;
  const url = rec.url ?? rec.u ?? "";
  const q = url.includes("?") ? url.slice(url.indexOf("?") + 1).split("#")[0] : "";
  if (new URLSearchParams(q).getAll("test").includes("1")) return true;
  for (const [k, v] of Object.entries(rec.headers ?? {})) if (k.toLowerCase() === "x-yard-test" && [v].flat().some((x) => String(x).trim() === "1")) return true;
  return false;
}
/** Drop logged test traffic and case-insensitive duplicates (first wins); strips the record so it never lands in the corpus. */
export function keepCorpusRows<T extends { prompt: string; rec?: LoggedRecord | null }>(rows: T[]): Omit<T, "rec">[] {
  const seen = new Set<string>();
  return rows.filter((w) => w.prompt && !isTestTraffic(w.rec) && !seen.has(w.prompt.toLowerCase()) && seen.add(w.prompt.toLowerCase())).map(({ rec: _rec, ...w }) => w);
}
