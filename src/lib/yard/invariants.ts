import { hardwareSaidNotBought } from "./hardwareSaid";
import { storeTermDrift } from "./listings";
import { genericFormMark, routesToLearner } from "./formOwnership";
import { generateFromPrompt, ignoredTypedWords } from "./promptMain";
import { resolvePurpose } from "./purposeForms";
import { namedFormOf } from "./form";
import { typedHeadNoun } from "./headNoun";
import { namedFormOwnsHead } from "./formOwnership";
import { sizePhrases } from "./sizePhrases";
import { isUnitItem, unitItemAsk } from "./unitItems";
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
import { footTalk, hungBuild, isOutdoorPrompt } from "./outdoor";
import { partLetters } from "./pdfDraw";
import { stepTones } from "./planStepPicture";
import { unownedParts } from "./ownEveryPart";
import { panelJoints } from "./modelJoints";
import type { BuildPlan, YardProject } from "./types";
import { typedAxesTalk } from "./pdf";
import { cutListIntro, pdfCutListIntro } from "./wholeItems";
import { namedStockDisplayName } from "./weekendStockHonesty";
import { isNamedLumberSpeciesId } from "./namedLumberSpecies";
import { applyShopJoin, listedPrice } from "./shopJoin";

export type InvariantId = "I1" | "I2" | "I3" | "I4" | "I5" | "I6" | "I7" | "I8" | "I9" | "I10" | "I11" | "I12" | "I13" | "I14" | "I17" | "I18" | "I19" | "I20" | "I21" | "I22" | "I23" | "I24" | "I25" | "C10" | "C11" | "C12";
export type Violation = { id: InvariantId; cls: string; msg: string };
export const INVARIANT_CLASS: Record<InvariantId, string> = {
  I1: "F1", I2: "F2", I3: "F3", I4: "F6", I5: "F12", I6: "F12", I7: "F1", I8: "F2", I9: "F7", I10: "F22", I11: "F9", I12: "F18", I13: "F21", I14: "F11", I17: "F47", I18: "F12", I19: "F12", I20: "F47", I21: "F2", I22: "F17", I23: "F17", I24: "F17", I25: "F12", C10: "C10", C11: "C11", C12: "C12",
};
/** The invariants checked per build (I2 and I10 are single fixed checks, run by the test directly). */
export const PER_BUILD: InvariantId[] = ["I1", "I3", "I4", "I6", "I7", "I8", "I9", "I11", "I12", "I13", "I14", "I17", "I18", "I19", "I20", "I21", "I22", "I23", "I24", "C10", "C11", "C12"];

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

/** I9: hardware the notes or steps tell you to use is on Buy (one vocabulary with the Buy pass, hardwareSaid.ts). */
function i9(p: YardProject, plan: BuildPlan): Violation[] {
  return hardwareSaidNotBought(p, plan).map((h) => v("I9", `steps or notes use ${h}s; Buy has none`));
}

const LEAKS: [RegExp, string][] = [
  [/\bBack is 0″|\b0″ wide\b|\b0" wide\b/, "0″ dimension"],
  [/\bboth \w+ as\b/, "'both X as'"],
  [/\bdrives 0\b/, "'drives 0'"],
  [/screws shelf into cleat/, "'shelf into cleat'"],
  [/\bundefined\b|\bNaN\b/, "undefined/NaN"],
];
/**
 * I11 (jargon and template leftovers): engine words, controls hints, debug counts and negations aimed at another
 * template never reach the person ("WASD", "still square, still a cut list", "214 joints · 307 members", "densified",
 * "not a Bridge / Tool steal", "Not a closet", "carcase", a "Shoe shelf" on a build that holds no shoes).
 */
export const JARGON: [RegExp, string][] = [
  [/\bWASD\b|mouse look/i, "controls hint"],
  [/still square, still a cut list/i, "'still square, still a cut list'"],
  [/\b\d+ joints? ·|· \d+ joints?\b|\b\d+ (?:short |long )?members?\b|\b\d+ nodes?\b|\bclusters?\b|\bmembers? after weld\b/i, "engine counts"],
  [/\bdensif/i, "'densify'"],
  [/\bsteal\b|shelving niche|\bnot an? (?:closet|dining table|cubby(?! wall)|Operate|Bridge|floor vanity|freestanding rectangle)\b/i, "negation aimed at another template"],
  [/\bcarcases?\b/i, "'carcase'"],
  [/\bWarren\b|\bface lace\b|\blaced into a truss\b/i, "truss jargon"],
];
const SHOE_OK = /\b(?:shoes?|shoelaces?|boots?|coat|entry(?:way)?|mudroom|hall(?:way)?|closet|wardrobe|organizer|cubb(?:y|ies)|rack)\b/i;

/** I11: no template text from another build. */
function i11(p: YardProject, plan: BuildPlan): Violation[] {
  const text = [...(p.notes ?? []), ...plan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`), ...plan.bom.map((b) => `${b.name} ${b.notes ?? ""}`)].join("\n");
  const out = LEAKS.filter(([re]) => re.test(text)).map(([, what]) => v("I11", `template leak: ${what}`));
  if (/\bcloset\b/i.test(text) && !/closet/i.test(`${p.prompt} ${p.name}`)) out.push(v("I11", "template leak: closet wording"));
  for (const [re, what] of JARGON) if (re.test(text)) out.push(v("I11", `jargon: ${what}`));
  // A typed-option hint ('Say "with a shoe shelf"') offers words; it is not a leftover part.
  if (/\bshoes?\b/i.test(text.replace(/"with [^"]*"/g, "")) && !SHOE_OK.test(`${p.prompt ?? ""} ${p.name}`)) out.push(v("I11", "template leak: shoe wording"));
  // Feet are the same feet Buy reads (outdoor.ts footTalk): legs, ground-standing sides, or sticks that reach the floor.
  if (/\bglides?\b/i.test(text) && (hungBuild(p) || !(footTalk(p).feet || p.panels.some((q) => q.position.y < 0.5)))) out.push(v("I11", "template leak: glides with no feet"));
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
function i20(p: YardProject, plan: BuildPlan, prompt = ""): Violation[] {
  // Spec 007 C2: a prompt that names one size-table item on its own is a purchased item, never a stand-in.
  if (!isUnitItem(p)) return prompt && unitItemAsk(prompt) ? [v("I20", `"${prompt}" names a bought item but built "${p.name}"`)] : [];
  const out: Violation[] = [];
  const steps = plan.instructions.map((s) => `${s.title}\n${s.description}`).join("\n");
  const cut = plan.instructions.find((s) => /^Cut the (?!cord\b)/.test(s.title));
  if (cut) out.push(v("I20", `purchased item has a cut step: "${cut.title}"`));
  if (/(?<![\d/.])0"/.test(steps)) out.push(v("I20", "purchased item shows a 0\" size"));
  const meta = `${plan.feasibility.summary}\n${plan.feasibility.issues.map((i) => i.message).join("\n")}`;
  if (/Opening is tight|weekend/i.test(meta)) out.push(v("I20", "purchased item carries furniture fit/rating text"));
  if (/\bmms\b|from the pack/i.test(steps)) out.push(v("I20", "purchased item text leak (mms / from the pack)"));
  // Spec 008: whole bought pieces never sit in the cut list, no cut row has a blank (0) size, and no text says "mm".
  const whole = plan.cutList.find((c) => !c.whole && !!unitSizeById(c.id.split("|")[0]) && !/kerf|cut from/i.test(plan.bom.find((b) => b.name === c.material)?.notes ?? ""));
  if (whole) out.push(v("I20", `whole bought piece listed as a cut: "${whole.name}"`));
  const blank = plan.cutList.find((c) => !(c.lengthIn > 0) || !(c.widthIn > 0) || !(c.thicknessIn > 0));
  if (blank) out.push(v("I20", `cut-list row with a blank size: "${blank.name}"`));
  const text = [...(p.notes ?? []), p.name, ...plan.instructions.map((s) => `${s.title} ${s.description}`), ...plan.bom.map((b) => `${b.name} ${b.notes ?? ""}`), ...plan.cutList.map((c) => `${c.name} ${c.notes ?? ""}`)].join("\n");
  if (/\d\s*mm\b/.test(text)) out.push(v("I20", "purchased item text uses mm (inches only)"));
  const bad = plan.bom.find((b) => /\bcut from\b|kerf/i.test(b.notes ?? ""));
  if (bad && /Nothing to cut/i.test(steps)) out.push(v("I20", `Buy says "${bad.notes}" but the steps say nothing to cut`));
  return out;
}

/** I21 (C2 size phrases): every phrase-derived axis ("knee high", "as wide as a queen bed", "6 foot shelf") holds within 1/2". */
function i21(p: YardProject, prompt: string): Violation[] {
  if (!p.panels.length || isUnitItem(p)) return [];
  const { axes, phrases } = sizePhrases(prompt);
  const o = p.overall;
  return (Object.entries(axes) as [keyof typeof axes, number][])
    .filter(([a, want]) => Math.abs(o[a] - want) > 0.5)
    .map(([a, want]) => v("I21", `"${phrases.join(", ")}" means ${want}" ${a}, model ${o[a]}`));
}

/**
 * I24 (Spec 007 C3 typed noun as title): a build from a library form that owns the typed head noun carries that
 * noun in its title ("pirate ship" → "Pirate ship", never "Sailing ship" over a galleon for "longship").
 */
function i24(p: YardProject, prompt: string): Violation[] {
  // Library-form titles only; fitted builders keep trade titles (Planter box, Coat bench) that other code keys on.
  // Spec 008: a bought-item build keeps the typed item noun too ("zip tie" → "Zip tie").
  if (prompt && p.name && isUnitItem(p)) {
    const ask = unitItemAsk(prompt);
    const typed = ask ? (prompt.toLowerCase().match(ask.unit.match)?.[0] ?? "").trim().split(/\s+/).pop()?.replace(/(?<!s)s$/, "") : null;
    return typed && !p.name.toLowerCase().replace(/\s+/g, "").includes(typed) ? [v("I24", `title "${p.name}" drops the typed item noun "${typed}"`)] : [];
  }
  if (!prompt || !p.name || p.fitted || resolvePurpose(prompt) || genericFormMark(p) || !namedFormOwnsHead(prompt)) return [];
  const head = typedHeadNoun(prompt);
  return head && !p.name.toLowerCase().includes(head) ? [v("I24", `title "${p.name}" drops the typed head noun "${head}"`)] : [];
}

export { genericFormMark } from "./formOwnership";

/** I23 (L1 live path): a prompt the engine builds from its own library or purpose table never reaches the learner. */
function i23(p: YardProject, prompt: string): Violation[] {
  if (genericFormMark(p) || !(resolvePurpose(prompt) || namedFormOf(prompt))) return [];
  return routesToLearner(prompt, p, ignoredTypedWords(p, prompt).length > 0) ? [v("I23", "the engine builds this form, but the live path sends it to the learner")] : [];
}

/** I22 (C1 named forms): a request that names a known form or purpose never falls back to a generic stand-in. */
function i22(p: YardProject, prompt: string): Violation[] {
  const named = resolvePurpose(prompt)?.form ?? namedFormOf(prompt);
  const mark = named ? genericFormMark(p) : null;
  return mark ? [v("I22", `names "${named}" but built a ${mark}`)] : [];
}

/** Every per-build invariant on one prompt's build. */
export function checkBuild(project: YardProject, prompt: string, plan: BuildPlan = buildPlan(project)): Violation[] {
  return [
    ...i1(project), ...i3(project, plan), ...i4(project, plan), ...i6(project, plan), ...i7(project), ...i8(project, prompt),
    ...i9(project, plan), ...i11(project, plan), ...i12(project, prompt), ...i13(project, prompt), ...i14(project, plan), ...i17(project),
    ...i18(project, plan), ...i19(project, plan), ...i20(project, plan, prompt), ...i21(project, prompt), ...i22(project, prompt), ...i23(project, prompt), ...i24(project, prompt), ...c10(project, plan), ...c11(project, plan, prompt), ...c12(plan),
  ];
}

/** I18 (F12 part ownership): every part is installed by one build step (same-named twins may share a step). */
function i18(p: YardProject, plan: BuildPlan): Violation[] {
  const out: Violation[] = [];
  const loose = unownedParts(p, plan);
  if (loose.length) out.push(v("I18", `${loose.map((x) => x.name).join(", ")} ${loose.length === 1 ? "has" : "have"} no owning step`));
  return out;
}

/** I19 (F12 step order): the back goes on before the fixed shelves it screws into. */
function i19(p: YardProject, plan: BuildPlan): Violation[] {
  const backAt = plan.instructions.findIndex((s) => /to the back of the box/.test(s.title));
  const shelfAt = plan.instructions.findIndex((s) => /\bfixed shel/i.test(s.title));
  if (backAt < 0 || shelfAt < 0 || backAt < shelfAt) return [];
  const thin = new Set(p.panels.filter((x) => Math.min(x.size.width, x.size.height, x.size.depth) < 0.5).map((x) => x.id));
  const shelves = new Set(p.panels.filter((x) => /shelf/i.test(x.name) && !thin.has(x.id)).map((x) => x.id));
  const fastens = panelJoints(p.panels).some((j) => (thin.has(j.a) && shelves.has(j.b)) || (thin.has(j.b) && shelves.has(j.a)));
  return fastens ? [v("I19", `the back goes on at step ${backAt + 1}, after the fixed shelves it screws into (step ${shelfAt + 1})`)] : [];
}

/** Recipes as the prompts that build them (the learned-recipe set). */
export const recipeKeys = () => RECIPES.recipes.map((r) => r.key);

/**
 * C10 (price consistency): same inputs, same total on every path. Picking the join the build already uses keeps the
 * Buy lines and the total; a picked join's fastener lines are priced by the same listing pass as every other Buy line;
 * the plan total is the Buy line sum.
 */
function c10(p: YardProject, plan: BuildPlan): Violation[] {
  if (p.displayOnly || !plan.bom.length) return [];
  const out: Violation[] = [];
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const sum = r2(plan.bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0));
  if (Math.abs(sum - plan.totals.estCostUsd) > 0.011) out.push(v("C10", `total $${plan.totals.estCostUsd} is not the Buy line sum $${sum}`));
  if (p.shopJoin) return out;
  if (plan.bom.some((b) => /wood screw/i.test(b.name))) {
    const again = buildPlan({ ...p, shopJoin: "screw", joinMethod: "screw" });
    if (again.totals.estCostUsd !== plan.totals.estCostUsd) out.push(v("C10", `picking the default screw join reprices $${plan.totals.estCostUsd} → $${again.totals.estCostUsd}`));
  }
  if (p.panels.length) {
    for (const join of ["glue", "dowel", "biscuit", "pocket"] as const) {
      for (const line of applyShopJoin({ ...p, shopJoin: join }, plan).bom.filter((b) => !plan.bom.some((a) => a.name === b.name))) {
        const priced = listedPrice({ ...line, offers: undefined });
        if (priced.estimatedCost != null && line.estimatedCost != null && Math.abs(priced.estimatedCost - line.estimatedCost) > 0.011) {
          out.push(v("C10", `${join} join line "${line.name}" priced $${line.estimatedCost}, listings say $${priced.estimatedCost}`));
        }
      }
    }
  }
  return out;
}

/** C12 (store terms follow the Buy name): every store search on a Buy row searches that row's name. */
function c12(plan: BuildPlan): Violation[] {
  return storeTermDrift(plan).map((d) => v("C12", d));
}

/**
 * C11 (whole items carry no cutting language): a bought whole item (zip tie, marble, washer) is its known trade
 * size, used as bought. Its PDF header never says "assumed, measure to lock", its cut list never says "Mark A on the
 * first cut", its steps never letter it like a cut ("One A 8" cable tie"), and its Material chip names the item, not
 * the first typed word ("Material: Zip"). Shelf pins and their holes are said in inches ("5 mm shelf pins" never).
 */
function c11(p: YardProject, plan: BuildPlan, prompt: string): Violation[] {
  const out: Violation[] = [];
  const say = [...plan.instructions.map((s) => `${s.title}. ${s.description} ${s.tips ?? ""}`), ...plan.bom.map((b) => `${b.name}. ${b.notes ?? ""}`)];
  const metricPin = say.flatMap((t) => t.split(/(?<=\.)\s+/)).find((t) => /\bpins?\b/i.test(t) && /\d\s*mm\b/i.test(t));
  if (metricPin) out.push(v("C11", `shelf pins said in mm: "${metricPin.slice(0, 80)}"`));
  if (!isUnitItem(p)) return out;
  const talk = typedAxesTalk(p).assumedTalk;
  if (talk) out.push(v("C11", `whole item header says "${talk}"`));
  if (/first cut/i.test(cutListIntro(plan))) out.push(v("C11", "whole item cut list says \"Mark A on the first cut\""));
  const pdfCraft = plan.partsKind === "whole" || (p.instances.length > 0 && p.panels.length === 0);
  if (plan.cutList.some((c) => c.whole) && plan.cutList.every((c) => c.whole) && /as you cut it/i.test(pdfCutListIntro(plan, pdfCraft))) out.push(v("C11", "whole item PDF cut list says \"as you cut it\""));
  const steps = plan.instructions.map((s) => `${s.title} ${s.description}`).join(" ");
  for (const c of plan.cutList) {
    if (!c.whole || !c.label) continue;
    const hit = steps.match(new RegExp(`\\b${c.label} ${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/^[A-Za-z]/, (ch) => `[${ch.toUpperCase()}${ch.toLowerCase()}]`)}`));
    if (hit) out.push(v("C11", `whole piece lettered like a cut: "${hit[0]}"`));
  }
  const label = namedStockDisplayName(prompt || (p.prompt ?? ""), getCatalogItem(p.primaryMaterialId));
  const pre = label.match(/^(\S+) · /)?.[1];
  if (pre && !isNamedLumberSpeciesId(pre) && !/^titebond$/i.test(pre)) out.push(v("C11", `Material chip reads "${pre}"`));
  return out;
}

/** The parts and steps a person sees, with ids kept (step pictures light parts by id). */
export function buildFingerprint(p: YardProject, plan: BuildPlan = buildPlan(p)): string {
  return JSON.stringify({
    name: p.name,
    panels: p.panels.map((x) => [x.id, x.name, x.size, x.position]),
    instances: p.instances.map((x) => [x.id, x.catalogId, x.position]),
    steps: plan.instructions,
    bom: plan.bom.map((b) => [b.name, b.quantity, b.estimatedCost]),
  });
}

/**
 * I25 (F12 deterministic steps): the same prompt gives identical parts, part ids and steps on every run. Eiffel's
 * step parts changed every build because ids came from Math.random (stableId.ts). Builds the prompt `runs` times.
 */
export function i25(prompt: string, runs = 3): Violation[] {
  const prints = Array.from({ length: runs }, () => buildFingerprint(generateFromPrompt(prompt)));
  const differ = prints.findIndex((x) => x !== prints[0]);
  return differ > 0 ? [v("I25", `run ${differ + 1} of "${prompt}" differs from run 1 (steps or part ids)`)] : [];
}
