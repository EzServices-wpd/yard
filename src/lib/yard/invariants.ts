import { isUnitItem } from "./unitItems";
/**
 * Critic's invariants (critic-kb/invariants.md I1–I14) as code: one checker per invariant, run on a
 * generated build and its plan. Pure, local, no network and no xAI. Each violation names its invariant
 * and failure class so the guards can ratchet (evals/invariants-baseline.json) and score (evals/score.json).
 */
import { buildPlan } from "./report";
import { supportsOf } from "./supportGraph";
import { spanFindings, stampSpanOffer } from "./spanCheck";
import { placementIndex } from "./placeEveryPart";
import { buildInfo } from "./buildInfo";
import { RECIPES, findRecipe } from "./recipes";
import { getCatalogItem } from "./catalog";
import { unitSizeById } from "./unitSizes";
import { isOutdoorPrompt } from "./outdoor";
import { partLetters } from "./pdfDraw";
import { stepTones } from "./planStepPicture";
import type { BuildPlan, YardProject } from "./types";

export type InvariantId = "I1" | "I2" | "I3" | "I4" | "I5" | "I6" | "I7" | "I8" | "I9" | "I10" | "I11" | "I12" | "I13" | "I14" | "I17" | "I20";
export type Violation = { id: InvariantId; cls: string; msg: string };
export const INVARIANT_CLASS: Record<InvariantId, string> = {
  I1: "F1", I2: "F2", I3: "F3", I4: "F6", I5: "F12", I6: "F12", I7: "F1", I8: "F2", I9: "F7", I10: "F22", I11: "F9", I12: "F18", I13: "F21", I14: "F11", I17: "F47", I20: "F47",
};
/** The invariants checked per build (I2 and I10 are single fixed checks, run by the test directly). */
export const PER_BUILD: InvariantId[] = ["I1", "I3", "I4", "I6", "I7", "I8", "I9", "I11", "I12", "I13", "I14", "I17", "I20"];

const v = (id: InvariantId, msg: string): Violation => ({ id, cls: INVARIANT_CLASS[id], msg });

/** I1: every panel reaches the floor or a wall through what it rests on. */
function i1(p: YardProject): Violation[] {
  if (!p.panels.length) return [];
  const sup = supportsOf(p);
  const wall = p.assumptions?.installMode === "wall" || p.assumptions?.installMode === "alcove";
  const memo = new Map<string, boolean>();
  const grounded = (id: string, seen: Set<string>): boolean => {
    if (memo.has(id)) return memo.get(id)!;
    const s = sup.get(id);
    if (!s) return true; // parts the graph does not track (hardware) are carried by their host
    if (s.how === "floor") return true;
    if (seen.has(id)) return wall; // a closed ring of parts on a wall-hung build hangs on the wall
    seen.add(id);
    const ok = s.on.length > 0 ? s.on.some((o) => grounded(o, seen)) : wall;
    memo.set(id, ok);
    return ok;
  };
  return p.panels.filter((q) => !grounded(q.id, new Set())).map((q) => v("I1", `${q.name} reaches neither the floor nor a wall`));
}

/** I3: cut-list counts equal model parts; plan total equals the Buy lines. */
function i3(p: YardProject, plan: BuildPlan): Violation[] {
  const out: Violation[] = [];
  if (!p.panels.length) return out;
  const cut = plan.cutList.reduce((t, c) => t + c.quantity, 0);
  const parts = p.panels.filter((q) => q.type !== "drawer" && q.materialId !== "hardware").length;
  if (plan.cutList.every((c) => !c.whole) && cut < parts) out.push(v("I3", `cut list has ${cut} pieces, model ${parts}`));
  const buy = Math.round(plan.bom.reduce((t, b) => t + (b.estimatedCost ?? 0), 0) * 100) / 100;
  if (Math.abs(buy - plan.totals.estCostUsd) > 0.02) out.push(v("I3", `total $${plan.totals.estCostUsd} ≠ Buy $${buy}`));
  return out;
}

/** I4: each lumber cut fits its board, or a splice step says how it is made. */
function i4(_p: YardProject, plan: BuildPlan): Violation[] {
  const splice = plan.instructions.some((s) => /splice/i.test(s.title));
  return plan.cutList
    .filter((c) => {
      const it = getCatalogItem((c.id ?? "").split("|")[0]);
      return !c.whole && it?.category === "lumber" && !!it.dims.length && c.lengthIn > it.dims.length + 0.01;
    })
    .filter(() => !splice)
    .map((c) => v("I4", `${c.name} ${c.lengthIn}" is longer than its board and no splice step makes it`));
}

/** I6: a build step lights some parts but never all of them. */
function i6(p: YardProject, plan: BuildPlan): Violation[] {
  if (!p.panels.length || p.panels.length < 3) return [];
  const L = partLetters(p, plan.cutList);
  const out: Violation[] = [];
  plan.instructions.forEach((s, i) => {
    const t = stepTones(p, plan, i, L);
    // Whole-unit steps (hang it, set it, shim it) are like Level: exempt.
    if (t.kind !== "build" || /\bit\b|\bthe unit\b/i.test(s.title)) return;
    const tones = [...t.tones.values()];
    const hot = tones.filter((x) => x === "hot").length;
    if (hot === 0) out.push(v("I6", `step ${i + 1} "${s.title}" lights nothing`));
    else if (hot === p.panels.length && i > 2 && !/^level it/i.test(s.title)) out.push(v("I6", `step ${i + 1} "${s.title}" lights every part`));
  });
  return out;
}

/** I7: no load member spans past its limit unless Add support is on offer. */
function i7(p: YardProject): Violation[] {
  // Critic: any span warning still showing is a fail (the build is not done until it is supported).
  return spanFindings(p).map((f) => v("I7", `${f.name} spans ${Math.round(f.span)}" (limit ${Math.round(f.allow)}")`));
}

/** I8: a typed W/H/D lands on the model (±1/8"). */
function i8(p: YardProject, prompt: string): Violation[] {
  const out: Violation[] = [];
  const typed = (re: RegExp) => { const m = prompt.match(re); return m ? Number(m[1]) : null; };
  const W = typed(/(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?\s*|"\s*)?wide\b/i);
  const H = typed(/(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?\s*|"\s*)?(?:tall|high)\b/i);
  const D = typed(/(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?\s*|"\s*)?deep\b/i);
  const o = p.overall;
  if (!o || !p.panels.length) return out;
  if (W && W <= 1200 && Math.abs(o.width - W) > 0.125) out.push(v("I8", `typed ${W} wide, model ${o.width}`));
  if (H && H <= 1200 && Math.abs(o.height - H) > 0.125) out.push(v("I8", `typed ${H} tall, model ${o.height}`));
  if (D && D <= 1200 && Math.abs(o.depth - D) > 0.125) out.push(v("I8", `typed ${D} deep, model ${o.depth}`));
  return out;
}

const HARDWARE = ["hinge", "pull", "knob", "carriage bolt", "lag screw", "latch", "wall anchor", "caster", "drawer slide", "glide", "coat hook"];
/** I9: hardware the notes or steps tell you to use is on Buy. */
function i9(p: YardProject, plan: BuildPlan): Violation[] {
  const said = `${(p.notes ?? []).join(" ")} ${plan.instructions.map((s) => `${s.title} ${s.description}`).join(" ")}`.toLowerCase();
  const buy = plan.bom.map((b) => `${b.name} ${b.searchQuery ?? ""}`.toLowerCase()).join(" | ");
  return HARDWARE.filter((h) => new RegExp(`\\b${h}s?\\b`).test(said) && !new RegExp(`\\b${h}`).test(buy) && !new RegExp(`no ${h}s?\\b|without (?:a )?${h}`).test(said))
    .map((h) => v("I9", `steps or notes use ${h}s; Buy has none`));
}

const LEAKS: [RegExp, string][] = [
  [/\bBack is 0″|\b0″ wide\b|\b0" wide\b/, "0″ dimension"],
  [/\bboth \w+ as\b/, "'both X as'"],
  [/\bdrives 0\b/, "'drives 0'"],
  [/screws shelf into cleat/, "'shelf into cleat'"],
  [/\bundefined\b|\bNaN\b/, "undefined/NaN"],
];
/** I11: no template text from another build. */
function i11(p: YardProject, plan: BuildPlan): Violation[] {
  const text = [...(p.notes ?? []), ...plan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`), ...plan.bom.map((b) => `${b.name} ${b.notes ?? ""}`)].join("\n");
  const out = LEAKS.filter(([re]) => re.test(text)).map(([, what]) => v("I11", `template leak: ${what}`));
  if (/\bcloset\b/i.test(text) && !/closet/i.test(`${p.prompt} ${p.name}`)) out.push(v("I11", "template leak: closet wording"));
  if (/\bglides?\b/i.test(text) && (p.assumptions?.installMode === "wall" || !p.panels.some((q) => q.position.y < 0.5))) out.push(v("I11", "template leak: glides with no feet"));
  return out;
}

/** I12: "Trusted" only on a trusted recipe or an unflagged built-in. */
function i12(p: YardProject, prompt: string): Violation[] {
  const info = buildInfo(stampSpanOffer(p));
  if (info.trust !== "Trusted") return [];
  const r = findRecipe(prompt);
  if (info.source !== "Built-in shape" && r && r.trust !== "trusted") return [v("I12", `labelled Trusted but recipe ${r.key} is ${r.trust}`)];
  if (spanFindings(p).length) return [v("I12", "Trusted while a span warning is up")];
  return [];
}

/** I13: outdoors, nothing on the ground is interior plywood. */
function i13(p: YardProject, prompt: string): Violation[] {
  if (!isOutdoorPrompt(prompt) || /plywood/i.test(prompt)) return [];
  return p.panels.filter((q) => /^plywood-/.test(q.materialId) && q.position.y < 0.5).map((q) => v("I13", `${q.name} is interior plywood on the ground outdoors`));
}

/** I14: no part is placed before a part it rests on. */
function i14(p: YardProject, plan: BuildPlan): Violation[] {
  if (!p.panels.length) return [];
  const at = placementIndex(p, plan.instructions);
  const out: Violation[] = [];
  for (const [id, info] of supportsOf(p)) {
    if (info.how !== "rests") continue;
    for (const s of info.on) {
      const a = at.get(id), b = at.get(s);
      if (a != null && b != null && a >= 0 && b > a) out.push(v("I14", `${info.name} is placed before ${p.panels.find((q) => q.id === s)?.name ?? s}, which it rests on`));
    }
  }
  return out;
}

/**
 * I17: no part is sized from packaging. A piece with a curated single-item size (unitSizes.ts) uses exactly
 * that size, and no placed piece is longer than one item or wider than twice its section (a box, not a clip).
 */
function i17(p: YardProject): Violation[] {
  const out: Violation[] = [];
  const ids = new Set([p.primaryMaterialId, ...p.instances.map((i) => i.catalogId), ...p.panels.map((x) => x.materialId)].filter(Boolean) as string[]);
  for (const id of ids) {
    const u = unitSizeById(id);
    const item = getCatalogItem(id);
    if (!u || !item) continue;
    for (const [k, want] of Object.entries(u.dims)) {
      const got = (item.dims as Record<string, number | undefined>)[k];
      if (got != null && Math.abs(got - (want as number)) > 1e-6) out.push(v("I17", `${u.name} is sized ${k} ${got}" from a listing, not one item's ${want}"`));
    }
    const across = Math.max(u.dims.width ?? 0, u.dims.diameter ?? 0, u.dims.thickness ?? 0);
    for (const inst of p.instances.filter((i) => i.catalogId === id)) {
      if ((inst.cutLength ?? 0) > (u.dims.length ?? Infinity) + 1e-6) out.push(v("I17", `${u.name} cut ${inst.cutLength}" long, longer than one ${u.dims.length}" piece`));
      const sec = (inst as { section?: { width?: number; height?: number } }).section;
      const big = Math.max(sec?.width ?? 0, sec?.height ?? 0);
      if (across > 0 && big > across * 2 + 1e-6 && big > 0.25) out.push(v("I17", `${u.name} drawn ${big}" across, a pack's size, not one piece's`));
    }
  }
  return [...new Map(out.map((x) => [x.msg, x])).values()];
}

/**
 * I20 (C3 purchased whole items): a build made of unit-table pieces has no cut step for the pieces, no 0" size,
 * no fit warning or furniture rating, and its Buy notes agree with the steps (no "cut"/"kerf" on whole pieces).
 */
function i20(p: YardProject, plan: BuildPlan): Violation[] {
  if (!isUnitItem(p)) return [];
  const out: Violation[] = [];
  const steps = plan.instructions.map((s) => `${s.title}\n${s.description}`).join("\n");
  const cut = plan.instructions.find((s) => /^Cut the (?!cord\b)/.test(s.title));
  if (cut) out.push(v("I20", `purchased item has a cut step: "${cut.title}"`));
  if (/(?<![\d/.])0"/.test(steps)) out.push(v("I20", "purchased item shows a 0\" size"));
  const meta = `${plan.feasibility.summary}\n${plan.feasibility.issues.map((i) => i.message).join("\n")}`;
  if (/Opening is tight|weekend/i.test(meta)) out.push(v("I20", "purchased item carries furniture fit/rating text"));
  if (/\bmms\b|from the pack/i.test(steps)) out.push(v("I20", "purchased item text leak (mms / from the pack)"));
  const bad = plan.bom.find((b) => /\bcut from\b|kerf/i.test(b.notes ?? ""));
  if (bad && /Nothing to cut/i.test(steps)) out.push(v("I20", `Buy says "${bad.notes}" but the steps say nothing to cut`));
  return out;
}

/** Every per-build invariant on one prompt's build. */
export function checkBuild(project: YardProject, prompt: string, plan: BuildPlan = buildPlan(project)): Violation[] {
  return [
    ...i1(project), ...i3(project, plan), ...i4(project, plan), ...i6(project, plan), ...i7(project), ...i8(project, prompt),
    ...i9(project, plan), ...i11(project, plan), ...i12(project, prompt), ...i13(project, prompt), ...i14(project, plan), ...i17(project), ...i20(project, plan),
  ];
}

/** Recipes as the prompts that build them (the learned-recipe set). */
export const recipeKeys = () => RECIPES.recipes.map((r) => r.key);
