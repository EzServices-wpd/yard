/**
 * The eval gate's grade of one build (scripts/eval-gate-lib.ts gradeOne calls this). Browser-safe: no node:fs.
 * A learned recipe is kept only when this same grade is strictly higher than the deterministic build, and the honest
 * checks do not mark it as a stand-in.
 */
import { honestChecks } from "../../../scripts/eval-gate-honest";
import type { Demands } from "../../../scripts/eval-gate-typed";
import { judgeRefusal, type ExpectedRefusals, type Refusal } from "../../../scripts/eval-gate-refusal";

export type AnswerKey = { width?: number; depth?: number; height?: number; pieces?: number; usd?: number; counts?: Record<string, number>; name?: string };

/** The only checkBuild IDs listed without grading. Every other ID grades. */
export const REPORT_ONLY_IDS: ReadonlySet<string> = new Set(["I26", "I27", "I28", "I30", "I32", "I37"]);

export type GradeEngine = {
  ignoredTypedWords: (p: any, q: string) => string[];
  checkBuild: (p: any, q: string, plan?: any) => { id: string; cls: string; msg: string }[];
  buildPlan: (p: any) => any;
  headerTitle: (p: any) => string;
  generateFromPrompt: (q: string) => any;
  graded: (id: string) => boolean;
  baseline: Record<string, { class: string; msg: string }>;
  refusals: ExpectedRefusals;
  genericFormMark?: (p: any) => string | null;
  genericBoxOverAsk?: (prompt: string, p: any) => boolean;
};

// ---------------------------------------------------------------- honor (ported from grok-intake-ab/engine.ts honor)
const lc = (s: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
export const r2 = (n: number) => Math.round(n * 100) / 100;
export const r16 = (n: number) => Math.round(n * 16) / 16;
const FEAT: [RegExp, RegExp][] = [
  [/rolling|caster|wheel/, /caster|wheel/], [/storage/, /lid|drawer|door|shelf|bin|box|storage|compartment/], [/dovetail/, /dovetail/], [/vise/, /vise/],
  [/wall/, /wall|cleat|hang|mount/], [/fold/, /fold|hinge/], [/door/, /door/], [/drawer/, /drawer/], [/shel/, /shelf|shelves/], [/lid/, /lid/],
  [/outdoor/, /outdoor|exterior|cedar|treated|2x6|weather/], [/covered/, /roof|cover/], [/black/, /black|paint/],
];
const COUNT: Record<string, RegExp> = { drawers: /^drawer front\b/i, doors: /\bdoor\b(?!\s*stop)/i, shelves: /^(?:adjustable |fixed |bottom |top |lower |middle )?shel(f|ves)\b(?!\s*pin)/i, steps: /\b(step|tread)\b/i, bins: /\bbin\b/i, legs: /\bleg\b/i, rods: /\brod\b/i, seats: /\bseat\b/i };

/**
 * Typed shelf count. Group by height inside each bay: two bays sharing a height are one level, and two
 * pieces at one height in the same bay count separately (a duplicate, not a second level in another bay).
 */
export function shelfLevelCount(panels: { name: string; position?: { x: number; y: number }; size?: { width: number } }[]): number {
  const hit = panels.filter((p) => COUNT.shelves.test(p.name) && p.position && p.size);
  const rows = new Map<number, typeof hit>();
  for (const p of hit) {
    const y = Math.round(p.position!.y * 4) / 4;
    const row = rows.get(y) ?? [];
    row.push(p);
    rows.set(y, row);
  }
  let n = 0;
  for (const row of rows.values()) {
    const parent = row.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const xOverlap = (a: (typeof hit)[number], b: (typeof hit)[number]) => Math.min(a.position!.x + a.size!.width, b.position!.x + b.size!.width) - Math.max(a.position!.x, b.position!.x);
    for (let i = 0; i < row.length; i++) for (let j = i + 1; j < row.length; j++) if (xOverlap(row[i], row[j]) > 1 / 32) parent[find(i)] = find(j);
    const sizes = new Map<number, number>();
    for (let i = 0; i < row.length; i++) sizes.set(find(i), (sizes.get(find(i)) ?? 0) + 1);
    n += Math.max(...sizes.values());
  }
  return n;
}
const MAT: [RegExp, RegExp][] = [[/popsicle|craft/, /popsicle|craft stick/], [/pvc/, /pvc/], [/cardboard/, /cardboard/], [/walnut/, /walnut/], [/cedar/, /cedar/], [/2x4/, /2x4|2×4/], [/1x6/, /1x6|1×6/], [/plywood/, /plywood/],
  // Added to the port: the named-species words the engine sells (named lumber species, C16).
  [/\boak\b/, /\boak\b/], [/maple/, /maple/], [/\bpine\b/, /\bpine\b/], [/cherry/, /cherry/], [/birch/, /birch/], [/poplar/, /poplar/], [/redwood/, /redwood/], [/\bmdf\b/, /\bmdf\b/], [/bamboo/, /bamboo/]];
export type HonorItem = { demand: string; kind: "noun" | "size" | "count" | "feature" | "budget" | "material" | "key"; ok: boolean | "disclosed"; shows: string };
export function honor(E: { ignoredTypedWords: (p: any, q: string) => string[] }, s: Demands, p: any, plan: any, builtFrom: string, expect?: AnswerKey) {
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
    // A typed shelf count is levels. The same height in two bays is one level; two pieces at that height in one bay are a duplicate.
    let n = names.filter((x) => re.test(x)).length;
    if (c.thing === "shelves") n = shelfLevelCount(p.panels);
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
/** pass / partial / fail from the graded invariant IDs only (all but REPORT_ONLY_IDS), plus the typed-word honor check. */
export function gradeOf(r: { empty: boolean; nounOk: boolean; scoredIds: string[]; honored: number; checkable: number }): Grade {
  if (r.empty || !r.nounOk || r.scoredIds.some((id) => FAIL_INVARIANTS.has(id))) return "fail";
  return r.scoredIds.length || r.honored < r.checkable ? "partial" : "pass";
}
export type Grade = "pass" | "partial" | "fail";

export type GradeRow = {
  grade: Grade;
  classes: string[];
  header: string | null;
  overall: string | null;
  pieces: number | null;
  usd: number | null;
  honor: { honored: number; checkable: number; demandsFrom: string; items: HonorItem[] };
  invariants: { id: string; cls: string; msg: string; known: boolean; scored: boolean }[];
  honest?: { cls: string; msg: string }[];
  refusal?: Refusal;
};

/** The gate's grade of a project already in hand. gradeOne returns this plus the prompt's identity fields. */
export function projectGrade(E: GradeEngine, e: { prompt: string; demands: Demands; demandsFrom: string; expect?: AnswerKey }, p: any, plan: any, builtFrom: string): GradeRow {
  let vs: { id: string; cls: string; msg: string }[] = [];
  try { vs = E.checkBuild(p, e.prompt, plan); } catch (err) { vs = [{ id: "I1", cls: "F1", msg: `checkBuild threw: ${String(err).slice(0, 80)}` }]; }
  const seen = new Set<string>();
  const invariants = vs.filter((x) => { const k = `${x.id}|${x.msg}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((x) => ({ id: x.id, cls: x.cls, msg: x.msg, known: `${x.id}|${e.prompt}` in E.baseline, scored: E.graded(x.id) }))
    .sort((a, b) => (a.id + a.msg < b.id + b.msg ? -1 : 1));
  const h = honor(E, e.demands, p, plan, builtFrom, e.expect);
  const honored = h.items.filter((i) => i.ok === true).length;
  const checkable = h.items.length;
  const scored = invariants.filter((v) => v.scored);
  const classes = new Set<string>();
  if (h.empty) classes.add("X-build");
  for (const v of scored) classes.add(v.cls);
  for (const i of h.items) if (i.ok !== true) classes.add(`T-${i.kind}`);
  let grade = gradeOf({ empty: h.empty, nounOk: h.nounOk, scoredIds: scored.map((v) => v.id), honored, checkable });
  const honest = h.empty ? [] : honestChecks(E, e.prompt, p, plan);
  for (const x of honest) classes.add(x.cls);
  if (honest.length) grade = "fail";
  const refusal = judgeRefusal(E, e.prompt, e.demands, p, plan, E.refusals) ?? undefined;
  if (refusal?.honest && !scored.length) { grade = "pass"; classes.clear(); }
  else if (refusal && !refusal.honest) { grade = "fail"; classes.add("X-refusal"); }
  let header: string | null = null;
  try { header = E.headerTitle(p); } catch { /* no header */ }
  const o = p.overall;
  return { grade, classes: [...classes].sort(), header, overall: o ? `${r16(o.width)}W × ${r16(o.depth)}D × ${r16(o.height)}H` : null, pieces: plan.totals.pieces, usd: r2(plan.totals.estCostUsd), honor: { honored, checkable, demandsFrom: e.demandsFrom, items: h.items }, invariants, ...(honest.length && !(refusal?.honest && !scored.length) ? { honest } : {}), ...(refusal ? { refusal } : {}) };
}

export const GRADE_RANK = { pass: 2, partial: 1, fail: 0 } as const;
