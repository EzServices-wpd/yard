/**
 * Save/use decision for a learned recipe. The grade is projectGrade, the same function the eval gate uses.
 * A recipe may be remembered, proposed, and shown only when that grade ranks strictly above the
 * deterministic build for the same prompt, and the honest checks do not mark it as a stand-in (closed shell,
 * unmatched body, lattice, fallback box, craft-stick, or any other honest-gate stand-in). A tie stays
 * on the engine. The recipe's own notes, parts and joints must also agree with the Buy: a stated count or
 * material matches the parts, a declared essential (mesh, a movement, a named species) is on the Buy, and
 * the Buy is proportionate to the part volume.
 */
import { honestChecks } from "../../../scripts/eval-gate-honest";
import { typedDemands, validateSpec, type Demands } from "../../../scripts/eval-gate-typed";
import refusalsFile from "../../../evals/expected-refusals.json";
import { getCatalogItem } from "./catalog";
import { genericBoxOverAsk } from "./genericBox";
import { genericFormMark } from "./formOwnership";
import { GRADE_RANK, REPORT_ONLY_IDS, projectGrade, type GradeEngine } from "./gateGrade";
import { checkBuild } from "./invariants";
import { NAMED_LUMBER_SPECIES } from "./namedLumberSpecies";
import { headerTitle } from "./pdf";
import { generateFromPrompt, ignoredTypedWords } from "./promptMain";
import { buildPlan } from "./report";
import type { BuildPlan, Panel, YardProject } from "./types";

const norm = (q: string) => q.replace(/\s+/g, " ").trim();

const CORPUS = [
  () => import("../../../evals/corpus/grok100.json"),
  () => import("../../../evals/corpus/live-walk.json"),
  () => import("../../../evals/corpus/nightly-sweep.json"),
  () => import("../../../evals/corpus/props-regressions.json"),
  () => import("../../../evals/corpus/review18.json"),
  () => import("../../../evals/corpus/sheet-stocks.json"),
  () => import("../../../evals/corpus/shelf-levels.json"),
];

let specs: Promise<Map<string, Demands>> | null = null;
/** Stored intake specs, where the gate has them. Otherwise the typed-word rules, which is what the gate uses too. */
export function demandsFor(prompt: string): Promise<Demands> {
  const q = norm(prompt);
  specs ??= (async () => {
    const map = new Map<string, Demands>();
    for (const load of CORPUS) {
      const mod = (await load()) as { default?: { prompts?: unknown[] }; prompts?: unknown[] };
      const file = mod.default ?? mod;
      for (const it of file.prompts ?? []) {
        if (!it || typeof it !== "object") continue;
        const row = it as { prompt?: string; spec?: unknown };
        if (typeof row.prompt !== "string") continue;
        const key = norm(row.prompt);
        const spec = row.spec ? validateSpec(row.spec, key) : null;
        if (spec?.head_noun && !map.has(key)) map.set(key, spec);
      }
    }
    return map;
  })();
  return specs.then((map) => map.get(q) ?? typedDemands(q)).catch(() => typedDemands(q));
}

const refusals = (refusalsFile as { refusals: GradeEngine["refusals"] }).refusals;

function engine(): GradeEngine {
  return {
    ignoredTypedWords,
    checkBuild,
    buildPlan,
    headerTitle,
    generateFromPrompt,
    graded: (id) => !REPORT_ONLY_IDS.has(id),
    baseline: {},
    refusals,
    genericFormMark,
    genericBoxOverAsk,
  };
}

/** Honest-gate stand-in marks. Any hit means the build is not the asked-for object. */
export function standInHits(prompt: string, project: YardProject, plan: BuildPlan) {
  return honestChecks(engine(), prompt, project, plan);
}

/** More layers than this glued face to face for one part is a solid block, not how the part is built. */
const MAX_PLIES = 6;

/**
 * Solid-block parts: a learned part the cut list glues up from more than MAX_PLIES layers (a 15 3/4" seat box from
 * 21 sheets, a 7" tower from 10). A real build frames those parts; a laminated block only stands in for them.
 */
export function solidBlockHits(plan: BuildPlan): string[] {
  const text = JSON.stringify(plan.cutList ?? []);
  return [...text.matchAll(/Glue up (\d+) layers face to face for each ([^"\\.]+)/g)].filter((m) => Number(m[1]) > MAX_PLIES).map((m) => `${m[1]} layers for each ${m[2]}`);
}

const SPECIES = NAMED_LUMBER_SPECIES.map((s) => s.display.toLowerCase());
/** Materials a note can declare. An "or" is met when the other side is what the Buy actually sells. */
const CLAIM = [...SPECIES, "hardwood", "mesh", "fabric", "canvas", "quartz", "glazed", "glazing", "acrylic", "glass", "polycarbonate", "plywood", "pressure-treated"];
const CARD: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, dozen: 12 };
/** A word between a count and the part it counts. "side" stays, so "two side rails" is not every rail. */
const ADJ = new Set(["wooden", "wood", "open", "vertical", "horizontal", "corner", "short", "tall", "long", "main", "raised", "folding", "removable", "standard", "typical", "single", "double", "even", "evenly", "spaced", "support", "supporting", "structural", "taut", "matching", "full", "rear", "front", "back", "left", "right", "top", "bottom", "upper", "lower"]);
/** Not a part count: a size, a fastener, or the sheet the Buy already counts. */
const SKIP_NOUN = new Set(["inch", "inches", "ft", "foot", "feet", "mm", "cm", "thick", "thickness", "wide", "long", "deep", "high", "tall", "diameter", "across", "class", "above", "ground", "edge", "length", "width", "height", "size", "screw", "screws", "nail", "nails", "bolt", "bolts", "joint", "joints", "coat", "coats", "layer", "layers", "pack", "packs", "box", "boxes", "bottle", "sheet", "sheets", "board", "boards", "piece", "pieces", "part", "parts", "end", "ends", "week", "weeks", "time", "times", "degree", "degrees"]);

const word = (w: string) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

/** Lines the builder adds (outdoor advice, the defining-parts sentence). They are not the recipe's declaration. */
function recipeSaid(notes: string[]): string[] {
  return notes.filter((n) => !/^Outdoors: (?:cedar or pressure-treated|untreated cedar)/.test(n)
    && !/built from its defining parts/.test(n)
    && !/^Glue the joints/.test(n)
    && !/^Feet run the full/.test(n)
    && !/\b(?:spins|swings|pivots) on\b/.test(n)
    && !/\b(?:folds|slides)\.$/.test(n)
    && !/dowel is sold/.test(n)
    && !/edge-glue boards to width/.test(n));
}

function stockText(project: YardProject, plan: BuildPlan): string {
  const names = [
    ...plan.bom.map((b) => `${b.name} ${b.notes ?? ""}`),
    ...plan.cutList.map((c) => c.material),
    ...project.panels.map((p) => getCatalogItem(p.materialId)?.name ?? ""),
  ];
  return names.join(" \n ").toLowerCase();
}

function stockHas(stock: string, w: string): boolean {
  if (w === "hardwood") return /\bhardwood\b/.test(stock) || SPECIES.some((s) => word(s).test(stock) && !/\bplywood\b/.test(stock));
  if (w === "glazed" || w === "glazing") return /acrylic|glass|polycarbonate|plexi/.test(stock);
  if (w === "mesh") return /mesh|hardware cloth/.test(stock);
  if (w === "quartz") return /quartz|clock movement|\bmovement\b/.test(stock);
  return word(w).test(stock);
}

/** A declared material is met by the Buy, or by the other side of an "or" that the Buy does sell. */
function claimMet(sentence: string, w: string, stock: string): boolean {
  if (!word(w).test(sentence)) return true;
  if (new RegExp(`\\bno\\s+(?:[\\w-]+\\s+){0,2}${w}|\\bwithout\\s+(?:a |any )?${w}`, "i").test(sentence)) return true;
  if (stockHas(stock, w)) return true;
  if (!/\bor\b/i.test(sentence)) return false;
  return sentence.split(/\bor\b/i).some((side) => CLAIM.some((m) => word(m).test(side) && stockHas(stock, m)));
}

function countMatching(words: string[], panels: Panel[]): number | null {
  let rest = words.slice();
  for (;;) {
    const last = rest[rest.length - 1].replace(/s$/, "");
    const pre = rest.slice(0, -1).join("\\s+");
    const re = new RegExp(`\\b${pre ? `${pre}\\s+` : ""}${last}s?\\b`, "i");
    const n = panels.filter((p) => re.test(p.name)).length;
    if (n > 0) return n;
    if (rest.length <= 1 || !ADJ.has(rest[0])) return null;
    rest = rest.slice(1);
  }
}

function numberAt(tokens: string[], i: number): { value: number; consumed: number } | null {
  if (tokens[i] === "pair" && tokens[i + 1] === "of") return { value: 2, consumed: 2 };
  if (tokens[i] === "dozen" || (tokens[i] === "a" && tokens[i + 1] === "dozen")) return { value: 12, consumed: tokens[i] === "a" ? 2 : 1 };
  const value = CARD[tokens[i]];
  if (value) return { value, consumed: 1 };
  if (/^\d+$/.test(tokens[i]) && !/^\d+$/.test(tokens[i + 1] ?? "")) return { value: Number(tokens[i]), consumed: 1 };
  return null;
}

/**
 * A count in the recipe's notes, or a spelled-out count in the joint steps, checked against the parts that
 * noun names. A digit in a step is a cut size or a part index ("shelf 1"), not a declared count.
 */
function countHits(text: string, panels: Panel[], digits: boolean): string[] {
  const hits: string[] = [];
  for (const sentence of text.split(/[.\n;]+/)) {
    const tokens = sentence.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      if (!digits && /^\d+$/.test(tokens[i])) continue;
      const num = numberAt(tokens, i);
      if (!num) continue;
      const start = i + num.consumed;
      if (/^\d+$/.test(tokens[start] ?? "")) continue;
      if (SKIP_NOUN.has(tokens[start] ?? "") || tokens[start] === "per") continue;
      const window = tokens.slice(start, start + 4);
      let best: { words: number; have: number; label: string } | null = null;
      for (let j = 0; j < window.length && !SKIP_NOUN.has(window[j]) && !/^\d+$/.test(window[j]); j++) {
        if (tokens[start + j + 1] === "per") break;
        const phrase = window.slice(0, j + 1);
        const have = countMatching(phrase, panels);
        if (have == null) continue;
        if (!best || phrase.length >= best.words) best = { words: phrase.length, have, label: phrase.join(" ") };
      }
      if (best && best.have !== num.value) hits.push(`notes say ${num.value} ${best.label}, the build has ${best.have}`);
    }
  }
  return hits;
}

function thicknessOf(raw: string): number | null {
  const m = raw.match(/(\d+)\s+(\d+)\/(\d+)/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  const f = raw.match(/(\d+)\/(\d+)/);
  if (f) return Number(f[1]) / Number(f[2]);
  const n = raw.match(/(\d+(?:\.\d+)?)/);
  return n ? Number(n[1]) : null;
}

/** "1.5 in thick" / "3/4 inch thick" against the parts that sentence names. */
function thicknessHits(notes: string[], panels: Panel[]): string[] {
  const hits: string[] = [];
  const wood = panels.filter((p) => p.materialId !== "hardware");
  for (const sentence of notes) {
    const m = sentence.match(/(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?|")\s*thick/i);
    if (!m) continue;
    const want = thicknessOf(m[1]);
    if (want == null) continue;
    const tokens = sentence.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !SKIP_NOUN.has(t) && !ADJ.has(t));
    const named = wood.filter((p) => tokens.some((t) => word(t.replace(/s$/, "")).test(p.name)));
    const check = named.length ? named : wood;
    const off = check.filter((p) => {
      const t = Math.min(p.size.width, p.size.height, p.size.depth);
      return Math.abs(t - want) > 0.2;
    });
    if (off.length === check.length && check.length) hits.push(`notes say ${m[1]} thick, parts are ${Math.min(...check.map((p) => Math.min(p.size.width, p.size.height, p.size.depth))).toFixed(2)} thick`);
  }
  return hits;
}

const FULL_SHEET = 2000;
/** A full sheet bought for parts that fill under 1% of it, or more sheets of one stock than a lamination (MAX_PLIES). */
function buyScaleHits(project: YardProject, plan: BuildPlan): string[] {
  const hits: string[] = [];
  const norm = (s: string) => s.toLowerCase().replace(/×/g, "x").replace(/\s+/g, " ");
  for (const line of plan.bom) {
    const item = line.catalogId ? getCatalogItem(line.catalogId) : undefined;
    if (!item || item.formFactor !== "sheet") continue;
    const face = (item.dims.length ?? 0) * (item.dims.width ?? 0);
    const thick = item.dims.thickness ?? 0;
    if (line.quantity > MAX_PLIES) hits.push(`${line.quantity} sheets of ${line.name} for the parts`);
    const cuts = plan.cutList.filter((c) => norm(c.material) === norm(line.name) || (line.catalogId && (c.id ?? "").includes(line.catalogId)));
    const volume = cuts.reduce((s, c) => s + c.lengthIn * c.widthIn * c.thicknessIn * c.quantity, 0);
    const one = face * thick;
    if (face >= FULL_SHEET && one > 0 && volume > 0 && volume < one * 0.01) hits.push(`a full sheet of ${line.name} for ${volume.toFixed(0)} cu in of parts`);
  }
  for (const line of plan.bom) {
    if (line.catalogId || !/\d$/.test(line.name.trim())) continue;
    const buy = line.name.toLowerCase().trim();
    const listed = project.panels.some((p) => {
      const base = p.name.toLowerCase().replace(/\s+\d+$/, "").trim();
      return base === buy || buy === p.name.toLowerCase().trim() || (base.length > 3 && (buy.startsWith(`${base} `) || p.name.toLowerCase().startsWith(`${buy} `)));
    });
    if (listed) hits.push(`${line.name} is a part listed on Buy, not stock the part is cut from`);
  }
  return hits;
}

/**
 * Where the recipe's own notes, parts and joints disagree with the Buy. Empty when a stated count or thickness
 * matches the parts, a declared essential is on the Buy, and the Buy is proportionate to the part volume.
 * The builder's own outdoor sentence is not a declaration.
 */
export function declarationHits(project: YardProject, plan: BuildPlan): string[] {
  const notes = recipeSaid(project.notes ?? []);
  const steps = (plan.instructions ?? []).map((s) => `${s.title} ${s.description ?? ""}`).join("\n");
  const stock = stockText(project, plan);
  const hits = [
    ...countHits(notes.join("\n"), project.panels, true),
    ...countHits(steps, project.panels, false),
    ...thicknessHits(notes, project.panels),
  ];
  for (const sentence of notes.join("\n").split(/[.\n;]+/)) {
    for (const w of CLAIM) if (!claimMet(sentence, w, stock)) hits.push(`notes say ${w}, Buy does not`);
    if (/\bfloorless\b|\bno floor\b|\bwithout (?:a |any )?floor\b|\bopen to the soil\b/i.test(sentence)
      && project.panels.some((p) => p.materialId !== "hardware" && /\b(floor|bottom)\b/i.test(p.name))) hits.push("notes say there is no floor, and a floor part is built");
  }
  for (const p of project.panels) {
    const name = p.name.toLowerCase();
    const one = `${getCatalogItem(p.materialId)?.name ?? ""} ${p.materialId}`.toLowerCase();
    for (const w of [...SPECIES, "hardwood", "fabric", "canvas", "mesh", "acrylic", "glass"]) {
      if (word(w).test(name) && !stockHas(one, w)) hits.push(`${p.name} is named ${w} and cut from ${getCatalogItem(p.materialId)?.name ?? p.materialId}`);
    }
  }
  return [...hits, ...buyScaleHits(project, plan)];
}

/**
 * The deterministic build may stay on the bench after a declined lookup only when it is itself no stand-in, is not
 * craft stock with no craft word typed, and the gate does not fail it. Otherwise the bench shows the labelled
 * display-only block: never a wrong object with a Buy list.
 */
export async function engineMayShow(prompt: string, engineBuild: YardProject, plan: BuildPlan = buildPlan(engineBuild)): Promise<boolean> {
  if (engineBuild.displayOnly) return false;
  // Craft stock with no craft word typed (a popsicle wall clock) is a model standing in for the real thing.
  const craft = engineBuild.craftLifted || /popsicle|craft|cardboard|skewer|paper|stick/i.test(engineBuild.primaryMaterialId ?? "");
  if (craft && !/popsicle|craft|cardboard|skewer|\btoy\b|model|miniature/i.test(prompt)) return false;
  if (standInHits(prompt, engineBuild, plan).length) return false;
  const demands = await demandsFor(prompt);
  return projectGrade(engine(), { prompt, demands, demandsFrom: "corpus-or-typed" }, engineBuild, plan, prompt).grade !== "fail";
}

/**
 * True only when the learned build is not a stand-in (honest checks, or a solid laminated block for a part),
 * its own notes, parts and Buy agree, and its gate grade ranks strictly above the deterministic build. A tie
 * stays on the engine: the catalog grows only when the recipe helps.
 */
export async function mayKeepLearned(prompt: string, learned: YardProject, learnedPlan: BuildPlan = buildPlan(learned)): Promise<boolean> {
  if (standInHits(prompt, learned, learnedPlan).length || solidBlockHits(learnedPlan).length || declarationHits(learned, learnedPlan).length) return false;
  const demands = await demandsFor(prompt);
  const E = engine();
  const row = { prompt, demands, demandsFrom: "corpus-or-typed" };
  const learnedGrade = projectGrade(E, row, learned, learnedPlan, prompt).grade;
  let base: YardProject;
  try { base = generateFromPrompt(prompt); } catch { return false; }
  const baseGrade = projectGrade(E, row, base, buildPlan(base), prompt).grade;
  return GRADE_RANK[learnedGrade] > GRADE_RANK[baseGrade];
}
