import { anchorInstalled, anchorKind, fastenerId } from "./wallAnchorSteps";
import { thicknessFailures } from "./stockThickness";
import { riderFloor, rodArrayFailures, rodArrays } from "./rodArrays";
import { countWasTyped, rowNeed, typedCount, typedSize } from "./recipeBuild";
import { hardwareSaidNotBought } from "./hardwareSaid";
import { drawerBoxes, isSolidDrawer } from "./hollowDrawers";
import { finishFor } from "./typedFinish";
import { panelRenderLook, WOOD_CATEGORIES } from "./partStock";
import { refineProject, DERIVED_TYPES } from "./refine";
const SIZE_STEPS = [["Wider", "2 inches wider"], ["Taller", "2 inches taller"], ["Deeper", "2 inches deeper"]] as const;
import { storeTermDrift } from "./listings";
import { cutStockOffBuy, duplicateHingeSteps, floorTalkOnSmall, noteStockOffBuy, stepHardwareOffBuy, stepStockNameDrift, unlinkedBuy } from "./buyComplete";
import { contactBuild, interiorSheet } from "./materialForUse";
import { genericFormMark, routesToLearner } from "./formOwnership";
import { closedCarcaseReadsAsk } from "./closedStorage";
import { askedDrawerCount, asksDoors, asksDrawers, DRAWER_COLUMN_MAX_IN } from "./frontSections";
import { slideForDepth } from "./stockLook";
import { inchFrac } from "./inchText";
import { generateFromPrompt, ignoredTypedWords } from "./promptMain";
import { resolvePurpose } from "./purposeForms";
import { namedFormOf } from "./form";
import { typedHeadNoun } from "./headNoun";
import { hunt } from "./hunter";
import { FEATURE_NOUN, featureBuilt, featureNoted, titleHeadNoun, typedFeatures } from "./typedFeatures";
import { namedFormOwnsHead } from "./formOwnership";
import { FIT_MEASURE, fitClause, sizePhrases, typedSizeTuple, typedWidth } from "./sizePhrases";
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
import { BACK_PART, fastensBack, stepScrewCount } from "./stepJointScrews";
import type { BuildPlan, YardProject } from "./types";
import { typedAxesTalk } from "./pdf";
import { cutListIntro, pdfCutListIntro } from "./wholeItems";
import { namedStockDisplayName } from "./weekendStockHonesty";
import { isNamedLumberSpeciesId } from "./namedLumberSpecies";
import { applyShopJoin, listedPrice } from "./shopJoin";
import { typedMeasures } from "./measureText";
import { boundPrompt } from "./promptLimits";
import { hiddenOverlaps, rotorPlayFailures } from "./solids";

export type InvariantId = "I1" | "I2" | "I3" | "I4" | "I5" | "I6" | "I7" | "I8" | "I9" | "I10" | "I11" | "I12" | "I13" | "I14" | "I17" | "I18" | "I19" | "I20" | "I21" | "I22" | "I23" | "I24" | "I25" | "I26" | "I27" | "I28" | "I29" | "I30" | "I31" | "I32" | "I35" | "I36" | "I37" | "I38" | "I41" | "I46" | "C10" | "C11" | "C12" | "C13" | "C14" | "C15" | "C16" | "C17" | "C18" | "C19";
export type Violation = { id: InvariantId; cls: string; msg: string };
export const INVARIANT_CLASS: Record<InvariantId, string> = {
  I1: "F1", I2: "F2", I3: "F3", I4: "F6", I5: "F12", I6: "F12", I7: "F1", I8: "F2", I9: "F7", I10: "F22", I11: "F9", I12: "F18", I13: "F21", I14: "F11", I17: "F47", I18: "F12", I19: "F12", I20: "F47", I21: "F2", I22: "F17", I23: "F17", I24: "F17", I25: "F12", I26: "F30", I27: "F31", I28: "F32", I29: "F12", I30: "F32", I31: "F17", I32: "F17", I35: "F21", I36: "F32", I37: "F9", I38: "F2", I41: "F17", I46: "F7", C10: "C10", C11: "C11", C12: "C12", C13: "C13", C14: "C14", C15: "C15", C16: "C16", C17: "C17", C18: "C18", C19: "C19",
};
/**
 * The invariants checked per build and scored (I2 and I10 are single fixed checks, run by the test directly).
 * I26, I27, I28, I30, I31 and I32 run on every build too (checkBuild) and ratchet in evals/invariants-baseline.json, but stay out of
 * the eval score until they join this list (which re-records evals/score.json's max).
 */
export const PER_BUILD: InvariantId[] = ["I1", "I3", "I4", "I6", "I7", "I8", "I9", "I11", "I12", "I13", "I14", "I17", "I18", "I19", "I20", "I21", "I22", "I23", "I24", "C10", "C11", "C12", "C13", "C14", "C15", "C16", "C17", "C18", "C19"];

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
  // One reader for a typed size (I35): "24 1/2 wide" is 24 1/2, never the 2 of its fraction.
  const { width: W, height: H, depth: D } = typedMeasures(prompt);
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
    .map(([a, want]) => v("I21", `"${phrases.join(", ")}" means ${want}" ${a}, model ${o[a]}`))
    .concat(i21Fit(p, prompt));
}

/**
 * I21 fit clause: only the measure of a space the build fills can set its width. A typed width or typed size wins
 * over the fit clause and keeps its order (width is the first number); a measure that belongs to a height, a person
 * or an object never becomes the width; a typed ceiling caps the height.
 */
function i21Fit(p: YardProject, prompt: string): Violation[] {
  const fc = fitClause(` ${prompt} `);
  if (!fc) return [];
  const o = p.overall;
  const out: Violation[] = [];
  const tuple = typedSizeTuple(prompt);
  const said = prompt.match(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:wide|width|w)\b/i);
  const typedW = said ? Number(said[1]) : tuple ? tuple[0] : null;
  if (typedW != null && Math.abs(o.width - typedW) > 0.5) out.push(v("I21", `typed ${typedW}" wide loses to "${fc.text.trim()}": model ${o.width}" wide`));
  if (tuple?.length === 3) {
    // A typed W × D × H keeps its other two axes too (each builder names its own depth/height, so as a pair).
    const want = [tuple[1], tuple[2]].sort((a, b) => a - b);
    const got = [o.depth, o.height].sort((a, b) => a - b);
    if (want.some((w, i) => Math.abs(w - got[i]) > 0.5)) out.push(v("I21", `typed ${tuple.join(" x ")} lost its order to "${fc.text.trim()}": model ${o.width} × ${o.depth} × ${o.height}`));
  }
  if (fc.space && typedW == null && !typedWidth(prompt) && Math.abs(o.width - fc.inches) > 0.5)
    out.push(v("I21", `"${fc.text.trim()}" names a ${fc.inches}" space: model ${o.width}" wide`));
  if (!fc.space && typedW == null && !typedWidth(prompt)) {
    // The measure of a height, a person or an object never sets the footprint: across and front to back, the model is
    // the build the same words make without that measure (a default that happens to equal the measure is fine).
    let twin: YardProject | null = null;
    for (const a of ["width", "depth"] as const) {
      if (Math.abs(o[a] - fc.inches) > 0.5) continue;
      twin ??= generateFromPrompt(prompt.replace(fc.text.trim(), fc.text.trim().replace(FIT_MEASURE, " ")).replace(/\s+/g, " ").trim());
      if (Math.abs(twin.overall[a] - o[a]) > 0.5) out.push(v("I21", `"${fc.text.trim()}" measures a ${fc.noun}, not a space: model is ${o[a]}" ${a === "width" ? "wide" : "deep"}`));
    }
  }
  if (fc.ceiling && o.height > fc.inches + 0.5) out.push(v("I21", `"${fc.text.trim()}": model ${o.height}" tall stands over the ceiling`));
  return out;
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

/**
 * I23 (L1 live path): a prompt the engine builds from its own library or purpose table never reaches the learner, nor
 * does a closed storage ask its own sheet carcase holds (typed size and interior counts, refiner :20).
 */
function i23(p: YardProject, prompt: string): Violation[] {
  const owned = !genericFormMark(p) && !!(resolvePurpose(prompt) || namedFormOf(prompt));
  if (!owned && !closedCarcaseReadsAsk(prompt, p, () => ignoredTypedWords(p, prompt))) return [];
  return routesToLearner(prompt, p, ignoredTypedWords(p, prompt).length > 0) ? [v("I23", "the engine builds this form, but the live path sends it to the learner")] : [];
}

/** I22 (C1 named forms): a request that names a known form or purpose never falls back to a generic stand-in. */
function i22(p: YardProject, prompt: string): Violation[] {
  const named = resolvePurpose(prompt)?.form ?? namedFormOf(prompt);
  const mark = named ? genericFormMark(p) : null;
  return mark ? [v("I22", `names "${named}" but built a ${mark}`)] : [];
}

const FRAC = "(\\d+(?:\\.\\d+)?)(?:\\s+(\\d+)\\/(\\d+))?";
const SIZED_REF = new RegExp(`\\b([A-Z]{1,2}) ([A-Z][A-Za-z]*(?: [a-z][A-Za-z]*){0,3})(?: \\d+)? — ${FRAC} × ${FRAC}`, "g");

/**
 * I29 (F12 one letter per piece): a step line that gives a part's letter and size ("G Center support 1 — 13 × 11 3/4")
 * uses the letter of the cut line with that size. When several cut lines share the name, the stranger picks up the
 * lettered piece, so a sibling's letter hands them the wrong board.
 */
function i29(plan: BuildPlan): Violation[] {
  const num = (w: string, a?: string, b?: string) => parseFloat(w) + (a && b ? Number(a) / Number(b) : 0);
  const fits = (c: BuildPlan["cutList"][number], d: number[]) => d.every((x) => [c.lengthIn, c.widthIn, c.thicknessIn].some((o) => Math.abs(o - x) < 0.07));
  const out = new Set<string>();
  for (const s of plan.instructions) for (const m of (s.description ?? "").matchAll(SIZED_REF)) {
    const line = plan.cutList.find((c) => c.label === m[1]);
    if (!line || line.name.toLowerCase() !== m[2].toLowerCase()) continue;
    const d = [num(m[3], m[4], m[5]), num(m[6], m[7], m[8])];
    const own = plan.cutList.find((c) => c !== line && c.name.toLowerCase() === line.name.toLowerCase() && fits(c, d));
    if (!fits(line, d) && own) out.add(`step ${s.step} letters "${m[0]}" ${line.label}, but that size is ${own.label} on the cut list`);
  }
  return [...out].slice(0, 3).map((m) => v("I29", m));
}

/** Every per-build invariant on one prompt's build. */
export function checkBuild(project: YardProject, prompt: string, plan: BuildPlan = buildPlan(project)): Violation[] {
  return [
    ...i1(project), ...i3(project, plan), ...i4(project, plan), ...i6(project, plan), ...i7(project), ...i8(project, prompt),
    ...i9(project, plan), ...i11(project, plan), ...i12(project, prompt), ...i13(project, prompt), ...i14(project, plan), ...i17(project),
    ...i18(project, plan), ...i19(project, plan), ...i20(project, plan, prompt), ...i21(project, prompt), ...i22(project, prompt), ...i23(project, prompt), ...i24(project, prompt), ...i29(plan), ...c10(project, plan), ...c11(project, plan, prompt), ...c12(plan), ...c13(project, plan, prompt), ...c14(project, prompt), ...c15(project, plan), ...c16(project, plan, prompt), ...c17(project, plan), ...c18(project, plan), ...c19(project, plan),
    ...i26(project), ...i27(project, prompt), ...i28(project, plan), ...i30(project), ...i31(project, prompt, plan), ...i32(project, plan), ...i35(project, prompt), ...i36(project, prompt), ...i37(project, plan), ...i38(project, plan), ...i41(project, prompt), ...i46(project, plan),
  ];
}

/** I30 (F32 follow-up, rod arrays fit their span): rods and what rides on them stay inside the parts that bound the row and clear each other (rodArrays.ts). */
function i30(p: YardProject): Violation[] {
  return rodArrayFailures(p as { panels: YardProject["panels"] }).map((m) => v("I30", m));
}

/**
 * I36 (F32 counted rows): one rule for every counted row of rods. A typed count is built as typed or nothing is
 * built; a refusal builds no parts and names the size that would build. A rider is never under its floor (the
 * thinnest dowel that takes the rod's bore). A row never runs past a typed size. An untyped count that shrank says
 * so on the card, naming the size the full count needs, in words that read plainly.
 */
/** "2 1/16" as inches. */
const shopInches = (t: string) => t.trim().split(/\s+/).reduce((n, w) => n + (w.includes("/") ? Number(w.split("/")[0]) / Number(w.split("/")[1]) : Number(w)), 0);
export function i36(p: YardProject, prompt: string): Violation[] {
  const out: string[] = [];
  if (p.refused) {
    if (p.panels.length) out.push(`refused but still built ${p.panels.length} parts`);
    if (!/\d[\d /]*" (?:wide|tall|deep)|\d+ or fewer/.test(p.refused)) out.push(`the refusal names no size or count that would build: "${p.refused}"`);
    return out.map((m) => v("I36", m));
  }
  if (p.cardNote && /built [\d /]+" with \d+\.$|built [\d /]+" without them/.test(p.cardNote)) out.push(`card note reads unclearly: "${p.cardNote}"`);
  const recipe = findRecipe(prompt);
  // Measured against the row's real minimum, not the build at hand, so a row too narrow to lay out (posts that
  // meet, rods fused into a block) is caught too: a build never stands at a typed size below what its count needs,
  // never runs past a typed size, and a note's size is the typed one.
  const need = recipe?.count ? rowNeed(recipe) : null;
  const typedRun = need && recipe ? typedSize(prompt, recipe)[need.axis] : undefined;
  if (need && typedRun != null && p.panels.length) {
    const a = need.axis === "width" ? "x" : need.axis === "height" ? "y" : "z";
    const lo = Math.min(...p.panels.map((q) => q.position[a])), hi = Math.max(...p.panels.map((q) => q.position[a] + q.size[need.axis]));
    const rods = p.panels.filter((q) => new RegExp(`^${need.one.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\d+$`, "i").test(q.name)).length;
    if (hi - lo > typedRun + 1 / 32 && !/, not the [\d /]+" typed\.$/.test(p.cardNote ?? "")) out.push(`the build runs ${inchFrac(hi - lo)}" past the ${inchFrac(typedRun)}" typed`);
    if (rods && typedRun < need.frame + rods * need.floor - 1e-3) out.push(`${rods} ${need.one}s built at ${inchFrac(typedRun)}", under the ${inchFrac(need.frame + rods * need.floor)}" they need`);
    const said = p.cardNote?.match(/^Only \d+ \S+ fits? in ([\d /]+)"/)?.[1];
    if (said && Math.abs(shopInches(said) - typedRun) > 1 / 64) out.push(`the card says "${said}"" but ${inchFrac(typedRun)}" was typed`);
  }
  for (const arr of rodArrays(p.panels)) {
    const rodDia = Math.min(arr.rods[0].size[arr.row[1]], arr.rods[0].size[arr.third[1]]);
    const floor = riderFloor(rodDia);
    const thin = arr.strung.flat().find((b) => Math.min(b.size[arr.row[1]], b.size[arr.third[1]]) < floor - 1e-3);
    if (thin) out.push(`${thin.name} is ${inchFrac(Math.min(thin.size[arr.row[1]], thin.size[arr.third[1]]))}" across, under the ${inchFrac(floor)}" a ${inchFrac(rodDia)}" rod's bore needs`);
    if (!recipe?.count) continue;
    if (countWasTyped(prompt, recipe)) {
      const n = typedCount(prompt, recipe);
      if (arr.rods.length !== n) out.push(`typed ${n} ${recipe.count.word}, built ${arr.rods.length}`);
    } else if (arr.rods.length < recipe.count.default && !/^Only \d+ .* needs [\d /]+"\.$/.test(p.cardNote ?? "")) {
      out.push(`${arr.rods.length} of the ${recipe.count.default} ${recipe.count.word} built with no card note naming the size the full count needs`);
    }
  }
  return out.map((m) => v("I36", m));
}

/** I28 (F32 stock thickness never scales): a part is its stock's thickness, or whole layers of it glued up and said so (stockThickness.ts). */
function i28(p: YardProject, plan: BuildPlan): Violation[] {
  return thicknessFailures(p, plan).map((m) => v("I28", m));
}

/**
 * I37 (F9 silent fallbacks, hunter.ts): a build that fell back to a body with no class, or whose title, notes, steps,
 * Buy or cut rows carry engine words, raw names, NaN/undefined, a 0″ size or decimal inches. One violation per
 * sub-check and what it found. Ratchets in evals/invariants-baseline.json (and evals/hunter-baseline.json over the
 * eval corpus); it stays out of PER_BUILD (the score) while its known hits are worked down.
 */
export function i37(p: YardProject, plan: BuildPlan): Violation[] {
  return hunt(p, plan).map((h) => v("I37", `${h.check}: ${h.what.replace(/ \(“.*$/, "")} (${h.where.replace(/\s.*$/, "")})`));
}

/**
 * I41 (F17 typed features, typedFeatures.ts): a feature word typed after the head noun (doors, drawers, a lid,
 * casters or wheels, shelves) never picks the build (no prehung door for "kitchen cart with 2 doors"), and each one
 * is built on the head noun's build or named in a note.
 */
export function i41(p: YardProject, prompt: string): Violation[] {
  // A refused build (tooSmall.ts) builds nothing and says why: a typed feature is not dropped on it.
  if (p.refused) return [];
  const q = prompt || p.prompt || "";
  const head = typedHeadNoun(q);
  const feats = typedFeatures(q);
  if (!head || !feats.length) return [];
  const out: Violation[] = [];
  const th = titleHeadNoun(p.name ?? "");
  if (p.kind === "opening" || (th && FEATURE_NOUN.test(th) && !(p.name ?? "").toLowerCase().includes(head))) out.push(v("I41", `the feature picked the build: "${p.name}" for a typed ${head}`));
  for (const f of feats) if (!featureBuilt(p, f) && !featureNoted(p, f)) out.push(v("I41", `typed ${f} neither built nor noted`));
  return out;
}

/**
 * I38 (F2 real parts, Critic #103 F2: 'bookcase 1/2 wide' built a Back, Top and Shelves -1" wide): no part dimension is
 * ever zero or negative, on any builder: every modelled part's three sizes, every instance's cut length and every
 * cut-list line's length, width and thickness. A size too small to hold its parts is refused instead.
 */
export function i38(p: YardProject, plan: BuildPlan): Violation[] {
  const out: string[] = [];
  const bad = (n: number | undefined) => n != null && !(n > 0);
  for (const q of p.panels) {
    const k = (["width", "height", "depth"] as const).find((a) => bad(q.size[a]));
    if (k) out.push(`${q.name} is ${Math.round(q.size[k] * 1000) / 1000}" ${k === "width" ? "wide" : k === "height" ? "tall" : "deep"}`);
  }
  for (const q of p.instances) if (bad(q.cutLength)) out.push(`${q.id} is cut ${q.cutLength}" long`);
  for (const c of plan.cutList) {
    const k = (["lengthIn", "widthIn", "thicknessIn"] as const).find((a) => bad(c[a]));
    if (k) out.push(`cut list: ${c.name} ${k.replace("In", "")} is ${Math.round(c[k] * 1000) / 1000}"`);
  }
  return out.map((m) => v("I38", m));
}

/**
 * I35 (F21 typed size, live 10-19 "shelf 24 1/2\" wide" built 2" wide): every number typed is the dimension built, to
 * 1/16", whichever way it is written (24 1/2, 24½, 24-1/2, 24.5, 2' 1/2", 2 ft 6 in, 2'6"), on an axis word or inside a
 * W x D x H string. A bought unit item keeps its own size, and a size over the input cap is said back (I10).
 */
export function i35(p: YardProject, prompt: string): Violation[] {
  if (!prompt || !p.panels.length || p.displayOnly || isUnitItem(p) || boundPrompt(prompt).note) return [];
  const typed = typedMeasures(prompt);
  const o = p.overall;
  const TOL = 1 / 16 + 1e-6;
  const out: string[] = [];
  for (const a of ["width", "depth", "height"] as const) {
    const want = typed[a];
    if (want != null && Math.abs(o[a] - want) > TOL) out.push(`typed ${inchFrac(want)}" ${a}, built ${inchFrac(o[a])}"`);
  }
  if (typed.tuple) {
    const want = [...typed.tuple].sort((x, y) => x - y), got = [o.width, o.depth, o.height].sort((x, y) => x - y);
    if (want.some((w, i) => Math.abs(w - got[i]) > TOL)) out.push(`typed ${typed.tuple.map((x) => `${inchFrac(x)}"`).join(" x ")}, built ${[o.width, o.depth, o.height].map((x) => `${inchFrac(x)}"`).join(" x ")}`);
  }
  return out.map((m) => v("I35", m));
}

/**
 * I32 (F17 hollow drawers): every drawer is a hollow five-part box (a front, two sides, a back and a 1/4" bottom, all
 * carrying the drawer's id) whose bottom is the cut list's 1/4" sheet, with an open top and nothing inside it.
 */
export function i32(p: YardProject, plan: BuildPlan): Violation[] {
  const out: string[] = [];
  const solid = p.panels.find((x) => isSolidDrawer(x));
  if (solid) out.push(`${solid.name} is a solid drawer block`);
  const ids = [...new Set(p.panels.filter((x) => x.type === "drawer" && x.drawerId).map((x) => x.drawerId!))];
  const bottomRows = plan.cutList.filter((c) => /^drawer bottom$/i.test(c.name));
  if (ids.length && bottomRows.some((c) => Math.abs(c.thicknessIn - 0.25) > 0.01 || !/1\/4"? plywood/i.test(c.material ?? ""))) out.push(`the cut list's drawer bottoms are not 1/4" plywood`);
  for (const id of ids) {
    const parts = p.panels.filter((x) => x.drawerId === id);
    const n = (k: string) => parts.filter((x) => x.drawerPart === k).length;
    const name = parts.find((x) => x.drawerPart === "back")?.name ?? id;
    if (n("side") !== 2 || n("back") !== 1 || n("bottom") !== 1 || n("front") !== 1) { out.push(`${name}: ${n("front")} front, ${n("side")} sides, ${n("back")} back, ${n("bottom")} bottom (a drawer is 1, 2, 1, 1)`); continue; }
    const bottom = parts.find((x) => x.drawerPart === "bottom")!;
    if (Math.abs(Math.min(bottom.size.width, bottom.size.height, bottom.size.depth) - 0.25) > 0.01) out.push(`${bottom.name} is not 1/4" thick`);
    const sides = parts.filter((x) => x.drawerPart === "side").sort((a, b) => a.position.x - b.position.x);
    const back = parts.find((x) => x.drawerPart === "back")!;
    const inner = { x0: sides[0].position.x + sides[0].size.width, x1: sides[1].position.x, y0: bottom.position.y + bottom.size.height, y1: sides[0].position.y + sides[0].size.height, z0: back.position.z + back.size.depth, z1: sides[0].position.z + sides[0].size.depth };
    const fill = p.panels.find((q) => !parts.includes(q) && Math.min(q.position.x + q.size.width, inner.x1) - Math.max(q.position.x, inner.x0) > 0.1 && Math.min(q.position.y + q.size.height, inner.y1) - Math.max(q.position.y, inner.y0) > 0.1 && Math.min(q.position.z + q.size.depth, inner.z1) - Math.max(q.position.z, inner.z0) > 0.1);
    if (fill) out.push(`${fill.name} fills the inside of ${name.replace(/\s*\bback\b/i, "")}`);
  }
  return out.slice(0, 4).map((m) => v("I32", m));
}

/**
 * I31 (F17 front sections): doors, drawers and shelves never share one opening or volume, and requested drawers build.
 * A door face never lies over a drawer front; a shelf never runs through a drawer box; a typed drawer count is the
 * model's (bare "drawers" builds at least one); an ask naming drawers and no doors has no doors; no drawer is wider
 * than one drawer column; a drawer on slides rides the longest standard slide its box takes; and the drawer bottoms are
 * cut from the cut list's stock in the steps too.
 */
export function i31(p: YardProject, prompt: string, plan: BuildPlan): Violation[] {
  if (p.displayOnly || p.standIn || p.unmatched) return [];
  const lower = (prompt || p.prompt || "").toLowerCase();
  const out: string[] = [];
  const doors = p.panels.filter((x) => x.type === "door");
  const fronts = p.panels.filter((x) => /\bdrawer front\b/i.test(x.name));
  const boxes = drawerBoxes(p.panels);
  const shelves = p.panels.filter((x) => x.type === "shelf" || /\bshelf\b/i.test(x.name));
  const span = (a: number, al: number, b: number, bl: number) => Math.min(a + al, b + bl) - Math.max(a, b);
  const face = (a: (typeof p.panels)[number], b: (typeof p.panels)[number]) => span(a.position.x, a.size.width, b.position.x, b.size.width) > 0.25 && span(a.position.y, a.size.height, b.position.y, b.size.height) > 0.25;
  const solid = (a: (typeof p.panels)[number], b: (typeof p.panels)[number]) => face(a, b) && span(a.position.z, a.size.depth, b.position.z, b.size.depth) > 0.25;
  for (const d of doors) { const f = fronts.find((q) => face(d, q)); if (f) { out.push(`${d.name} lies over ${f.name}`); break; } }
  for (const sh of shelves) { const b = boxes.find((q) => solid(sh, q)); if (b) { out.push(`${sh.name} runs through ${b.name}`); break; } }
  const typed = /\b(?:\d+|an?|one|single|two|three|four|five|six|seven|eight|nine|ten)\s+(?:[a-z]+\s+)?drawers?\b/.test(lower);
  const want = askedDrawerCount(lower);
  if (want && (typed ? boxes.length !== want : boxes.length === 0)) out.push(`asks for ${typed ? want : "some"} drawer${want === 1 ? "" : "s"}, the model has ${boxes.length}`);
  // A hanging section (rod) keeps its own doors; the drawers get their own section.
  const hangs = p.panels.some((x) => /\bhanging rod\b|\bclothes rod\b/i.test(x.name));
  if (asksDrawers(lower) && !asksDoors(lower) && doors.length && !hangs) out.push(`names drawers and no doors, the model has ${doors.length} door${doors.length === 1 ? "" : "s"}`);
  const wide = boxes.find((b) => b.size.width > DRAWER_COLUMN_MAX_IN + 1e-6);
  if (wide) out.push(`${wide.name} is ${inchFrac(wide.size.width)}" wide, more than one ${DRAWER_COLUMN_MAX_IN}" drawer column`);
  const slideRow = plan.bom.find((b) => /side-mount drawer slides/i.test(b.name));
  const slideLen = slideRow ? Number(slideRow.name.match(/^(\d+)"/)?.[1]) : NaN;
  const deep = boxes.length ? Math.max(...boxes.map((b) => b.size.depth)) : 0;
  if (slideRow && (slideLen > deep + 0.01 || slideLen !== slideForDepth(deep))) out.push(`${slideLen}" slides on a ${inchFrac(deep)}" deep drawer box (it takes ${slideForDepth(deep)}")`);
  const bottomRow = plan.cutList.find((c) => /^drawer bottom$/i.test(c.name));
  const boardBottoms = plan.instructions.find((st) => /\bDrawer bottom \(\d+ boards/.test(st.description ?? ""));
  if (bottomRow && /plywood/i.test(bottomRow.material ?? "") && boardBottoms) out.push(`step ${boardBottoms.step} glues the drawer bottoms from boards, the cut list cuts them from ${bottomRow.material}`);
  return out.map((m) => v("I31", m));
}


/** I26 (F30 no hidden overlap): no two solid parts share space unless a joint the plan cuts makes room (solids.ts). */
function i26(p: YardProject): Violation[] {
  return hiddenOverlaps(p).map((m) => v("I26", m));
}

/** I27 (F31 held rotors): every part that turns on a pin is held along it by stops on both sides (solids.ts). */
function i27(p: YardProject, prompt: string): Violation[] {
  const slides = new Set((findRecipe(prompt || p.prompt || "")?.moving ?? []).filter((m) => m.motion === "slide").map((m) => m.part));
  return rotorPlayFailures(p, slides).map((m) => v("I27", m));
}

/** I18 (F12 part ownership): every part is installed by one build step (same-named twins may share a step). */
function i18(p: YardProject, plan: BuildPlan): Violation[] {
  const out: Violation[] = [];
  const loose = unownedParts(p, plan);
  if (loose.length) out.push(v("I18", `${loose.map((x) => x.name).join(", ")} ${loose.length === 1 ? "has" : "have"} no owning step`));
  return out;
}

/**
 * I46 (F7 Buy = steps, the other way from I9; Critic #107 row 199): every screw Buy lists is driven in some step,
 * and every back is fastened in some step. The joint-screw line's count is the count the steps drive (when the
 * steps state counts at all, else some step must screw); any other screw line (structural, lag, pocket) is named
 * by the step that drives it, by its own kind word, or lists it by id; wall-anchor lines (lag, anti-tip, rated anchors)
 * count only when a step lists their id, and every fastener a step lists or a structural screw it drives is on Buy; a back part (never a drawer's back) is in the parts of a step
 * that says how it is fastened. Report-only: it ratchets in evals/invariants-baseline.json, outside PER_BUILD.
 */
export function i46(p: YardProject, plan: BuildPlan): Violation[] {
  const out: Violation[] = [];
  const steps = plan.instructions.filter((s) => !/^(?:Cut|Confirm)\b/i.test(s.title));
  const text = (s: (typeof steps)[number]) => `${s.title}. ${s.description ?? ""}`;
  for (const b of plan.bom) {
    if (!/screw/i.test(b.name)) continue;
    const total = Number(b.notes?.match(/(\d+) screws from the model's joints/)?.[1] ?? NaN);
    if (Number.isFinite(total)) {
      const n = stepScrewCount(plan);
      if (n > 0 && n !== total) out.push(v("I46", `Buy counts ${total} ${b.name} from the model's joints; the steps drive ${n}`));
      if (n > 0) continue;
    }
    if (anchorKind(b)) continue;
    const kind = /nail/i.test(b.name) ? /nail|screw/i : /structural/i.test(b.name) ? /structural|\bstuds?\b/i : /pocket/i.test(b.name) ? /pocket/i : /screw/i;
    if (!steps.some((s) => kind.test(text(s)) || (s.fastenersUsed ?? []).includes(fastenerId(b)))) out.push(v("I46", `Buy lists ${b.name}; no step drives them`));
  }
  // Wall-anchor hardware (lag screws, anti-tip kit, rated wall anchors) is tied by id: a step lists the Buy line it installs.
  for (const b of plan.bom) if (anchorKind(b) && !anchorInstalled(plan, b)) out.push(v("I46", `Buy lists ${b.name}; no step installs that line`));
  // The other way: every fastener a step lists is a Buy line, and a step that drives structural screws has them on Buy.
  const onBuy = new Set(plan.bom.map(fastenerId));
  for (const s of steps) for (const id of s.fastenersUsed ?? []) if (!onBuy.has(id)) out.push(v("I46", `Step ${s.step} drives ${id.replace(/^buy:/, "")}; Buy does not list it`));
  if (steps.some((s) => /\bstructural screws?\b/i.test(text(s))) && !plan.bom.some((b) => /structural/i.test(b.name))) out.push(v("I46", "A step drives structural screws; Buy does not list them"));
  for (const back of p.panels.filter((x) => !x.drawerId && BACK_PART.test(x.name))) {
    if (!plan.instructions.some((s) => fastensBack(s, back.name))) out.push(v("I46", `${back.name} is in no step that fastens it`));
  }
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

/** Typed purposes the engine must build as themselves (class C13): the noun phrase, and the name the build must carry. */
const TYPED_PURPOSES: { ask: RegExp; name: RegExp; label: string }[] = [
  { ask: /\b(?:standing|sit[- ]?stand)\s+desk\s+(?:converter|riser|topper)\b|\bdesk\s+converter\b/, name: /converter|riser/i, label: "standing desk converter" },
  { ask: /\bguitar\s+(?:wall\s+)?(?:hanger|hook|holder|mount)\b/, name: /guitar/i, label: "guitar hanger" },
  { ask: /\boutdoor\s+storage\s+bench\b/, name: /bench/i, label: "outdoor storage bench" },
  { ask: /\braised\s+(?:garden|planter|vegetable)\s+bed\b/, name: /raised .*bed/i, label: "raised garden bed" },
];
const TYPED_ROLLING = /\brolling\b(?!\s+(?:pin|ball|marble|hills?|stock|shutter|ladder))|\bon\s+(?:locking\s+)?(?:casters|castors|wheels)\b|\bwith\s+(?:locking\s+)?(?:casters|castors)\b|\bmobile\b(?=\s+[a-z])/;

/**
 * C13 (a typed modifier or purpose survives): the purpose noun is the build's name, not a generic form ("standing
 * desk converter" is never a Desk, "guitar hanger" never a Shelf); "outdoor" keeps exterior stock; a raised bed has no
 * bottom and no glides; "rolling" / "on casters" puts casters under it.
 */
function c13(p: YardProject, plan: BuildPlan, prompt: string): Violation[] {
  const lower = prompt.toLowerCase(), out: Violation[] = [];
  if (/\b(?:craft|popsicle|lolly)\s*sticks?\b/.test(lower) || p.historic || p.displayOnly) return out;
  for (const t of TYPED_PURPOSES) {
    if (!t.ask.test(lower)) continue;
    if (!t.name.test(p.name) || p.standIn) out.push(v("C13", `typed "${t.label}" built as "${p.name}"`));
    if (!/\b(?:craft|popsicle)\b/.test(lower) && plan.bom.some((b) => /popsicle|craft stick/i.test(b.name))) out.push(v("C13", `typed "${t.label}" built from craft sticks`));
    if (/\boutdoor\b/.test(lower) && (p.panels.some((x) => /^plywood/.test(x.materialId) && !/exterior|pressure|cdx/i.test(getCatalogItem(x.materialId)?.name ?? "")) || !plan.bom.some((b) => /exterior|pressure-treated|cedar/i.test(b.name))))
      out.push(v("C13", `typed "outdoor" but the build is indoor stock`));
    if (/raised/.test(t.label)) {
      if (p.panels.some((x) => /\bbottom\b/i.test(x.name))) out.push(v("C13", "raised bed has a bottom"));
      if (plan.bom.some((b) => /glides?/i.test(b.name))) out.push(v("C13", "raised bed sits on furniture glides, not the soil"));
    }
  }
  if (TYPED_ROLLING.test(lower) && p.assumptions?.installMode !== "wall" && !p.panels.some((x) => /^Caster \d+$/.test(x.name)))
    out.push(v("C13", `typed "${lower.match(TYPED_ROLLING)![0]}" but no casters are drawn`));
  return out;
}

/** Named small objects with a real form (class C14): what the prompt names, the parts that make it that object. */
const SMALL_FORMS: { ask: RegExp; name: RegExp; parts: RegExp[]; label: string }[] = [
  { ask: /\bbird\s*feeder\b/, name: /feeder/i, parts: [/tray/i, /roof/i], label: "bird feeder" },
  { ask: /\bjewel(?:le)?ry\s+(?:box|chest|case)\b/, name: /jewel/i, parts: [/\blid\b/i, /divider/i], label: "jewelry box" },
];
const MOUNTED_HOUSE = /\b(?:hanging|wall[- ]?mounted|wall[- ]?mount)\s+(?:bird\s*house|birdhouse)\b/;

/**
 * C14 (a named small object is its real form, engine-owned): a bird feeder has a tray and a roof, a jewelry box a lid
 * and dividers, never a plain box; a hanging or wall-mounted birdhouse is built by the engine with its mount hardware.
 */
function c14(p: YardProject, prompt: string): Violation[] {
  const lower = prompt.toLowerCase(), out: Violation[] = [];
  if (/\b(?:craft|popsicle|lolly)\s*sticks?\b/.test(lower) || p.historic || p.displayOnly) return out;
  const learner = () => routesToLearner(prompt, p, ignoredTypedWords(p, prompt).length > 0);
  for (const f of SMALL_FORMS) {
    if (!f.ask.test(lower)) continue;
    if (!f.name.test(p.name) || p.standIn) out.push(v("C14", `typed "${f.label}" built as "${p.name}"`));
    const missing = f.parts.filter((r) => !p.panels.some((x) => r.test(x.name)));
    if (missing.length) out.push(v("C14", `${f.label} is a plain box: no ${missing.map((r) => r.source.replace(/\\b/g, "")).join(", ")}`));
    if (learner()) out.push(v("C14", `${f.label} goes to the learner`));
  }
  if (MOUNTED_HOUSE.test(lower)) {
    if (learner()) out.push(v("C14", "mounted birdhouse goes to the learner"));
    if (!p.panels.some((x) => /^(?:Screw eye \d+|Mounting board)$/.test(x.name))) out.push(v("C14", "mounted birdhouse has no screw eyes or mounting board"));
  }
  return out;
}

/**
 * C15 (hardware and Buy completeness): every stock the cut list cuts from is on Buy, every fastener size and hardware
 * item a step fits is on Buy, every Buy row has a store link, and a lumber size the notes name is one Buy sells.
 */
function c15(p: YardProject, plan: BuildPlan): Violation[] {
  if (p.displayOnly || !plan.bom.length) return [];
  return [
    ...(isUnitItem(p) ? [] : cutStockOffBuy(plan)).map((m) => v("C15", `cut list stock "${m}" is not on Buy`)),
    ...stepHardwareOffBuy(plan).map((m) => v("C15", m)),
    ...stepStockNameDrift(plan).map((m) => v("C15", m)),
    ...unlinkedBuy(plan).map((n) => v("C15", `Buy row "${n}" has no store link`)),
    ...noteStockOffBuy(p.notes ?? [], plan).map((m) => v("C15", m)),
  ];
}

/**
 * C16 (material for use): a build that touches food, skin or a nest carries no pressure-treated stock, and an outdoor
 * build carries no interior sheet goods.
 */
function c16(p: YardProject, plan: BuildPlan, prompt: string): Violation[] {
  if (p.displayOnly) return [];
  const out: Violation[] = [];
  const outdoor = isOutdoorPrompt(prompt) || plan.bom.some((b) => b.catalogId === "outdoor-finish");
  if (outdoor && contactBuild({ ...p, prompt })) for (const b of plan.bom.filter((x) => /pressure[- ]treated/i.test(x.name))) out.push(v("C16", `"${b.name}" on a build that touches food, skin or a nest`));
  if (outdoor && !/\bplywood\b/i.test(prompt)) for (const b of plan.bom.filter(interiorSheet)) out.push(v("C16", `interior sheet "${b.name}" on an outdoor build`));
  return out;
}

/** C17 (step and placement text): one step hangs each hinge, and a tabletop or small hung build never sits on the floor. */
function c17(p: YardProject, plan: BuildPlan): Violation[] {
  if (p.displayOnly) return [];
  return [...duplicateHingeSteps(plan), ...floorTalkOnSmall(p, plan)].map((m) => v("C17", m));
}

/**
 * C18 (typed finish or colour): a typed "black", "white", "painted" or "stained" renders as that colour on every wood
 * part, and Buy carries that paint or stain as a real product with a link.
 */
function c18(p: YardProject, plan: BuildPlan): Violation[] {
  const f = finishFor(p, plan);
  if (!f) return [];
  const out: Violation[] = [];
  const wood = p.panels.filter((x) => WOOD_CATEGORIES.has(getCatalogItem(panelRenderLook("", x).catalogId)?.category ?? ""));
  const off = wood.filter((x) => panelRenderLook(p.prompt ?? "", x).tone !== f.tone);
  if (off.length) out.push(v("C18", `typed ${f.word}: ${off.length} wood part${off.length > 1 ? "s" : ""} (${off[0].name}) do not render ${f.key}`));
  const row = plan.bom.find((b) => b.name === f.product.name);
  if (!row) out.push(v("C18", `typed ${f.word}: no ${f.kind} on Buy`));
  else if (!(row.offers ?? []).some((o) => o.href)) out.push(v("C18", `typed ${f.word}: "${row.name}" has no store link`));
  return out;
}

/**
 * C19 (derived counts re-derive on size steps): Wider, Taller and Deeper are never refused for a count that follows from
 * the size (center supports, shelves, rails), and after the step the cut list, the model and Buy still agree.
 */
const C19_SEEN = new Map<string, Violation[]>();
const typeCounts = (q: YardProject) => JSON.stringify(q.panels.reduce<Record<string, number>>((m, x) => ((m[x.type] = (m[x.type] ?? 0) + 1), m), {}));
function c19(p: YardProject, plan: BuildPlan): Violation[] {
  if (p.displayOnly || p.standIn || !plan.cutList.length || isUnitItem(p)) return [];
  // Only boxes and frames carry counts that follow from size (stick models and bought items have none).
  if (!p.panels.some((x) => x.type === "upright" || x.type === "side" || DERIVED_TYPES.includes(x.type))) return [];
  // Same build, same answer (the refine is deterministic): memoised so a corpus checks each build once.
  const memo = `${p.prompt}|${p.primaryMaterialId}|${p.overall.width}|${p.overall.height}|${p.overall.depth}|${typeCounts(p)}`;
  const hit = C19_SEEN.get(memo);
  if (hit) return hit;
  const out = c19Run(p, plan);
  if (C19_SEEN.size > 500) C19_SEEN.clear();
  C19_SEEN.set(memo, out);
  return out;
}
function c19Run(p: YardProject, plan: BuildPlan): Violation[] {
  const out: Violation[] = [];
  const syncBefore = i3(p, plan).length + cutStockOffBuy(plan).length;
  // Each step twice in a row (a span limit is often crossed on the second tap: 36 → 38 → 40 wide).
  for (const [label, phrase] of SIZE_STEPS) {
    let cur = p;
    for (const tap of [1, 2]) {
      const r = refineProject(cur, phrase);
      const derived = r.refused.find((t) => DERIVED_TYPES.some((d) => t.includes(`change the ${d}s`)));
      if (derived) { out.push(v("C19", `${label} ×${tap} refused: ${derived.replace(/^"[^"]*":\s*/, "")}`)); break; }
      if (!r.project) break;
      const recount = typeCounts(r.project) !== typeCounts(cur);
      cur = r.project;
      // Only a step that re-derived a count can put the cut list out of step with the model and Buy.
      if (!recount) continue;
      const after = buildPlan(cur);
      const syncAfter = [...i3(cur, after).map((x) => x.msg), ...cutStockOffBuy(after).map((m) => `cut list stock "${m}" is not on Buy`)];
      if (syncAfter.length > syncBefore) { out.push(v("C19", `after ${label} ×${tap}: ${syncAfter[0]}`)); break; }
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
